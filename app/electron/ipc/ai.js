const { ipcMain } = require('electron')
const https = require('node:https')
const { loadEnv } = require('../lib/env')
const { runClaude } = require('../lib/claude')
const { fetchConfluencePage } = require('../lib/confluence')
const { extractKeywords, findRelevantCode, expandToServiceRoots, learnFromDiff } = require('../lib/codeSearch')
const { execSync } = require('node:child_process')
const path = require('node:path')

function adfToText(node) {
  if (!node) return ''
  if (node.type === 'text') {
    const hasStrike = Array.isArray(node.marks) && node.marks.some(m => m.type === 'strike')
    if (hasStrike) return ''
    return node.text || ''
  }
  if (node.type === 'emoji') return node.attrs?.text || node.attrs?.shortName || ''
  if (node.type === 'table') {
    return (node.content || []).map(row => {
      const cells = (row.content || []).map(cell => adfToText(cell).trim()).join(' | ')
      return cells
    }).filter(Boolean).join('\n')
  }
  if (Array.isArray(node.content)) return node.content.map(adfToText).join(node.type === 'paragraph' ? '\n' : '')
  return ''
}

function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

function fetchJiraIssue(issueKey, jiraBaseUrl, jiraEmail, jiraApiToken) {
  const hostname = jiraBaseUrl.replace(/^https?:\/\//, '')
  const basicAuth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,description,issuetype,priority,labels,components,assignee,status,comment`,
      method: 'GET',
      headers: { Authorization: 'Basic ' + basicAuth, Accept: 'application/json' },
    }
    const req = https.request(options, (r) => {
      let b = ''
      r.on('data', c => { b += c })
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(JSON.parse(b))
        else reject(new Error(`Jira HTTP ${r.statusCode}: ${b.slice(0, 200)}`))
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function getDefaultBranch(root) {
  try {
    const headRef = execSync(`git -C "${root}" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`, { encoding: 'utf-8', shell: '/bin/bash' }).trim()
    return headRef.replace('refs/remotes/origin/', '') || 'main'
  } catch {}
  for (const candidate of ['main', 'master', 'DEV', 'develop']) {
    try {
      execSync(`git -C "${root}" rev-parse "origin/${candidate}" 2>/dev/null`, { shell: '/bin/bash' })
      return candidate
    } catch {}
  }
  return 'main'
}

function getRepoDiff(root, branch, reposBaseDir) {
  const defaultBranch = getDefaultBranch(root)
  try { execSync(`git -C "${root}" fetch origin "${branch}" "${defaultBranch}" --depth=100 2>/dev/null`, { timeout: 20000, shell: '/bin/bash' }) } catch {}

  const changedFiles = execSync(
    `git -C "${root}" diff --name-only "origin/${defaultBranch}...origin/${branch}" 2>/dev/null || ` +
    `git -C "${root}" diff --name-only "${defaultBranch}...${branch}" 2>/dev/null || echo ""`,
    { encoding: 'utf-8', timeout: 10000, shell: '/bin/bash' }
  ).trim()

  if (!changedFiles) return null

  const repoName = path.relative(reposBaseDir, root) || path.basename(root)
  const allFiles = changedFiles.split('\n').filter(Boolean)
  const isTestFile = f => /[Tt]est|[Ss]pec|__tests__|\.test\.|\.spec\./.test(f)
  const testFiles = allFiles.filter(isTestFile)
  const prodFiles = allFiles.filter(f => !isTestFile(f))

  function gitDiff(files) {
    if (!files.length) return ''
    const args = files.slice(0, 30).map(f => `"${f}"`).join(' ')
    try {
      return execSync(
        `git -C "${root}" diff "origin/${defaultBranch}...origin/${branch}" -- ${args} 2>/dev/null || ` +
        `git -C "${root}" diff "${defaultBranch}...${branch}" -- ${args} 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 15000, shell: '/bin/bash', maxBuffer: 4 * 1024 * 1024 }
      ).trim()
    } catch { return '' }
  }

  return { repoName, changedFiles: allFiles, testFiles, prodFiles, testDiff: gitDiff(testFiles), prodDiff: gitDiff(prodFiles).slice(0, 12000) }
}

function register() {
  ipcMain.handle('ai-generate-session', async (_, { issueKey, useCodeContext = true, manualKeywords = [] }) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken, anthropicKey, anthropicBaseUrl, confluenceBddPageId, reposBaseDir } = loadEnv()

    if (!anthropicKey) return { error: 'ANTHROPIC_AUTH_TOKEN not set in environment' }
    if (!issueKey) return { error: 'Provide a Jira issue key' }
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      return { error: 'JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN must be set in .env to use the AI session feature' }
    }

    let issueData
    try {
      issueData = await fetchJiraIssue(issueKey, jiraBaseUrl, jiraEmail, jiraApiToken)
    } catch (e) {
      return { error: `Failed to fetch Jira issue: ${e.message}` }
    }

    const fields = issueData.fields || {}
    const summary = fields.summary || ''
    const issueType = fields.issuetype?.name || ''
    const priority = fields.priority?.name || ''
    const labels = (fields.labels || [])
    const components = (fields.components || []).map(c => c.name)
    const status = fields.status?.name || ''
    const description = adfToText(fields.description).slice(0, 3000)

    let bddStandards = ''
    if (confluenceBddPageId && jiraBaseUrl && jiraEmail && jiraApiToken) {
      try {
        bddStandards = await fetchConfluencePage(confluenceBddPageId, jiraBaseUrl, jiraEmail, jiraApiToken)
        console.log(`[ai-generate] loaded BDD standards (${bddStandards.length} chars)`)
      } catch (e) {
        console.log(`[ai-generate] could not fetch Confluence BDD page: ${e.message}`)
      }
    }

    const bddExpertIdentity = bddStandards
      ? `You are a BDD specialist and QA engineer. Your Gherkin scenarios must strictly follow the team's standards documented below — treat this as your source of truth for scenario structure, language, naming, and formatting.\n\nTEAM BDD STANDARDS:\n${bddStandards}\n\nApply these standards to every scenario you write. Do not deviate from the conventions above.`
      : `You are a BDD specialist and QA engineer. Write Gherkin scenarios following best practices: clear Given/When/Then structure, one behaviour per scenario, declarative style, no UI implementation details in steps.`

    const issueSection = `Issue: ${issueKey}\nType: ${issueType}\nPriority: ${priority}\nStatus: ${status}\nLabels: ${labels.join(', ') || 'none'}\nComponents: ${components.join(', ') || 'none'}\nSummary: ${summary}\nDescription:\n${description || '(no description)'}`

    const autoKeywords = extractKeywords([summary, description].join(' '), { components, labels })
    const keywords = manualKeywords.length ? [...new Set([...manualKeywords, ...autoKeywords])] : autoKeywords
    const codeContext = useCodeContext && reposBaseDir ? await findRelevantCode(keywords, reposBaseDir, { components }) : ''
    const codeSection = codeContext
      ? `RELEVANT SOURCE CODE (from local repositories — use this as ground truth for the implementation):\n\`\`\`\n${codeContext}\n\`\`\``
      : ''

    const prompt = `${bddExpertIdentity}

Based on the information below, generate a structured QA session plan.

${issueSection}${codeSection ? '\n\n' + codeSection : ''}

Return a JSON object with this exact structure (no markdown, just raw JSON):
{
  "qaNotes": ["string", "string"],
  "impacts": ["string", "string"],
  "cases": [
    {
      "name": "short descriptive name",
      "status": "Draft",
      "priority": "Normal",
      "objective": "one sentence describing what this test validates",
      "precondition": "what must be true before running this test",
      "scenario": "Given ...\nWhen ...\nThen ...",
      "productComponent": "",
      "squadTeam": "",
      "regressionTests": "No"
    }
  ]
}

Rules:
- qaNotes: 3-5 items describing important requirements and risks the QA must validate for this feature
- impacts: 3-5 areas of the system that could be affected by this change
- cases: generate as many test cases as needed to fully cover the feature — typically 5-10. Always cover: happy path, negative/error cases, edge cases, and boundary conditions.
- All text in English.`

    try {
      const text = await runClaude(prompt, { anthropicKey, anthropicBaseUrl })
      const result = parseJson(text)
      if (!result) return { error: `Claude returned an unexpected response — raw output: ${text.slice(0, 300)}` }
      console.log('[ai-generate] parsed:', JSON.stringify(result).slice(0, 300))
      return { success: true, issueKey, summary, result }
    } catch (e) {
      return { error: `Claude API error: ${e.message}` }
    }
  })

  ipcMain.handle('analyze-branch', async (_, { branch, prDescription, session }) => {
    const { anthropicKey, anthropicBaseUrl, reposBaseDir, githubOrg } = loadEnv()

    if (!anthropicKey) return { error: 'ANTHROPIC_AUTH_TOKEN not set in environment' }
    if (!branch) return { error: 'Branch name is required' }

    const useMcp = !reposBaseDir && !!githubOrg
    if (!reposBaseDir && !githubOrg) {
      return { error: 'Set either REPOS_BASE_DIR (local repos) or GITHUB_ORG (GitHub MCP) in .env' }
    }

    const issueKey = session?.issueInfo?.issue || 'unknown'
    const proposedCases = (session?.cases || []).map((c, i) =>
      `  ${i + 1}. ${c.name || '(unnamed)'} — ${c.objective || ''}`
    ).join('\n') || '  (none saved)'
    const proposedNotes = (session?.qaNotes || []).map((n, i) => `  ${i + 1}. ${typeof n === 'string' ? n : (n?.text || JSON.stringify(n))}`).join('\n') || '  (none)'
    const proposedImpacts = (session?.impacts || []).map((n, i) => `  ${i + 1}. ${typeof n === 'string' ? n : (n?.text || JSON.stringify(n))}`).join('\n') || '  (none)'
    const prDescSection = prDescription?.trim()
      ? `## PR Description (written by the developer):\n${prDescription.trim()}\n`
      : ''

    let diffSection = ''

    if (useMcp) {
      diffSection = `Use the GitHub MCP tool to fetch the diff for branch "${branch}" across all repositories in the "${githubOrg}" GitHub organization. For each repo where the branch exists and has changes ahead of the default branch, retrieve the list of changed files and the full diff. Then use that diff to perform the analysis below.`
    } else {
      const serviceRoots = expandToServiceRoots(reposBaseDir)
      const roots = serviceRoots.length ? serviceRoots : [reposBaseDir]

      const diffs = []
      for (const root of roots) {
        try {
          const d = getRepoDiff(root, branch, reposBaseDir)
          if (d) diffs.push(d)
        } catch {}
      }

      if (!diffs.length) {
        return { error: `No changes found for branch "${branch}" across repos in ${reposBaseDir}. Make sure the branch exists and has commits ahead of main.` }
      }

      const sessionText = [
        session?.issueInfo?.issue || '',
        ...(session?.qaNotes || []).map(n => typeof n === 'string' ? n : (n?.text || '')),
      ].join(' ')
      const sessionKeywords = extractKeywords(sessionText)
      const touchedModules = diffs.map(d => d.repoName).filter(Boolean)
      if (sessionKeywords.length && touchedModules.length) {
        learnFromDiff(sessionKeywords, touchedModules)
      }

      diffSection = diffs.map(d => {
        const parts = []
        if (d.testDiff) parts.push('#### Test files (full diff):\n```diff\n' + d.testDiff + '\n```')
        if (d.prodDiff) parts.push('#### Production files (truncated to 12 000 chars):\n```diff\n' + d.prodDiff + '\n```')
        const fileList = d.changedFiles.map(f => '  - ' + f).join('\n')
        return '### Repo: ' + d.repoName + '\nChanged files:\n' + fileList + '\n\n' + parts.join('\n\n')
      }).join('\n\n')
    }

    const prompt = `You are a senior QA engineer reviewing a pull request branch.

## Session context — Issue: ${issueKey}

### Proposed test cases (from AI session analysis):
${proposedCases}

### QA notes (risks & acceptance criteria identified):
${proposedNotes}

### Possible impacts identified:
${proposedImpacts}

## Branch: ${branch}

${prDescSection}
${diffSection}

---

Analyze the branch diff above and return a JSON object with this exact structure (no markdown, just raw JSON):
{
  "automatedTests": {
    "unit": [{"file": "relative/path/to/file.ext", "description": "what is tested"}],
    "acceptance": [{"file": "relative/path/to/file.ext", "description": "what is tested"}],
    "e2e": [{"file": "relative/path/to/file.ext", "description": "what is tested"}]
  },
  "coverageAssessment": "2-3 sentence overall assessment of test coverage quality",
  "adherence": {
    "score": "High | Medium | Low",
    "summary": "2-3 sentences on whether the PR aligns with the proposed QA plan",
    "covered": ["which proposed test cases or QA notes are addressed by this PR"],
    "missing": ["which proposed test cases or QA notes are NOT addressed or tested"]
  },
  "coverageGaps": [
    {
      "area": "ClassName or method name changed in the diff",
      "file": "relative/path/to/changed/production/file.ext",
      "change": "one sentence describing what was changed in that area",
      "risk": "High | Medium | Low",
      "suggestion": "one sentence describing what test case should be added to cover this"
    }
  ]
}

Rules:
- unit: files matching patterns like Test.java, Spec.kt, .test.ts, .spec.ts
- acceptance: integration/acceptance tests — SpringBootTest, @DataJpaTest, Cucumber features, etc.
- e2e: end-to-end tests — Cypress, full Playwright flows, BDD feature files
- If a category has no tests, return an empty array []
- Be precise: use actual file names from the diff
- coverageGaps: list ONLY production code changes (not test files) that have NO corresponding test case in the proposed QA plan above. If every changed area is covered, return an empty array []. Focus on changed methods, classes, or logic paths — not trivial changes like renaming or formatting.
- All text in English`

    try {
      const text = await runClaude(prompt, { anthropicKey, anthropicBaseUrl })
      const result = parseJson(text)
      if (!result) return { error: `Claude returned an unexpected response: ${text.slice(0, 300)}` }
      return { success: true, branch, issueKey, result }
    } catch (e) {
      return { error: `Analysis error: ${e.message}` }
    }
  })

  ipcMain.handle('run-skill', async (_, { prompt }) => {
    const { anthropicKey, anthropicBaseUrl } = loadEnv()
    if (!anthropicKey) return { error: 'ANTHROPIC_AUTH_TOKEN not set in environment' }
    if (!prompt) return { error: 'Prompt is required' }
    try {
      const text = await runClaude(prompt, { anthropicKey, anthropicBaseUrl })
      return { success: true, text }
    } catch (e) {
      return { error: `Claude API error: ${e.message}` }
    }
  })
}

module.exports = { register }
