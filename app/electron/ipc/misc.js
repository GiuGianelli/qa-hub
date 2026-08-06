const { ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const https = require('node:https')
const { spawn, execSync } = require('node:child_process')
const { ROOT, loadEnv } = require('../lib/env')
const { runClaude } = require('../lib/claude')

function parseHostname(jiraBaseUrl) {
  return jiraBaseUrl.replace('https://', '').replace('http://', '').split('/')[0]
}

function adfHeading(text) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] }
}
function adfParagraph(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}
function adfBulletList(lines) {
  return {
    type: 'bulletList',
    content: lines.map(line => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }],
    })),
  }
}

function pickUser(users, displayName) {
  const exact = users.find(u => (u.displayName || '').toLowerCase() === displayName.toLowerCase())
  return (exact || users[0]).accountId || null
}

function jiraGet(hostname, urlPath, auth) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path: urlPath, method: 'GET', headers: { Authorization: 'Basic ' + auth, Accept: 'application/json' } },
      res => {
        let body = ''
        res.on('data', d => { body += d })
        res.on('end', () => {
          try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON response')) }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

function jiraPost(hostname, auth, body) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname,
        path: '/rest/api/3/issue',
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = ''
        res.on('data', d => { data += d })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.key) resolve({ key: parsed.key })
            else resolve({ error: parsed.errors ? JSON.stringify(parsed.errors) : 'Failed to create issue' })
          } catch { resolve({ error: 'Invalid response from Jira' }) }
        })
      }
    )
    req.on('error', e => resolve({ error: e.message }))
    req.write(body)
    req.end()
  })
}

async function resolveJiraAccountId(displayName, jiraBaseUrl, jiraEmail, jiraApiToken) {
  if (!displayName || !jiraBaseUrl || !jiraEmail || !jiraApiToken) return null
  const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
  const hostname = parseHostname(jiraBaseUrl)
  const urlPath = `/rest/api/3/user/search?query=${encodeURIComponent(displayName)}&maxResults=5`
  try {
    const users = await jiraGet(hostname, urlPath, auth)
    return Array.isArray(users) && users.length > 0 ? pickUser(users, displayName) : null
  } catch { return null }
}

async function createJiraSubtask({ issueSummary, issueKey, jiraBaseUrl, jiraEmail, jiraApiToken, jiraProject }) {
  const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
  const hostname = parseHostname(jiraBaseUrl)
  const body = JSON.stringify({
    fields: {
      project: { key: jiraProject },
      parent: { key: issueKey },
      summary: `[QA Test Creation] ${issueSummary}`,
      issuetype: { name: 'ENG QA Task' },
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'QA task for test planning.' }] }],
      },
    },
  })
  return jiraPost(hostname, auth, body)
}

function processImportOutput(fullOutput, resolved, project) {
  const caseResults = {}
  const importedKeys = []

  const okIndexed = new RegExp(String.raw`\[(\d+)\/${resolved.length}\]\s+OK\s+(${project}-T\w+)`, 'g')
  for (const m of fullOutput.matchAll(okIndexed)) {
    const idx = Number.parseInt(m[1]) - 1
    caseResults[idx] = { ok: true, key: m[2] }
    importedKeys.push(m[2])
  }

  if (importedKeys.length === 0) {
    const okBare = new RegExp(String.raw`\bOK\s+(${project}-T\w+)`, 'g')
    for (const m of fullOutput.matchAll(okBare)) importedKeys.push(m[1])
  }

  const failIndexed = new RegExp(String.raw`\[(\d+)\/${resolved.length}\]\s+FAIL`, 'g')
  for (const m of fullOutput.matchAll(failIndexed)) {
    const idx = Number.parseInt(m[1]) - 1
    if (!caseResults[idx]) caseResults[idx] = { ok: false }
  }

  const casesWithResult = resolved.map((tc, i) => ({ ...tc, _importResult: caseResults[i] || null }))
  return { importedKeys, caseResults, casesWithResult }
}

function register() {
  ipcMain.handle('read-env', () => {
    const { project, jiraBaseUrl, githubToken, githubOrg, githubRepo, confluenceQaNotesUrl, confluenceGherkinUrl } = loadEnv()
    return { jiraProject: project, jiraBaseUrl, githubToken, githubOrg, githubRepo, confluenceQaNotesUrl, confluenceGherkinUrl }
  })

  ipcMain.handle('open-external', (_, url) => shell.openExternal(url))

  ipcMain.handle('fetch-issue-summary', async (_, { issueKey }) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = loadEnv()
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken || !issueKey) return { summary: null }
    const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
    const hostname = parseHostname(jiraBaseUrl)
    try {
      const json = await jiraGet(hostname, `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary`, auth)
      return { summary: json.fields?.summary || null }
    } catch { return { summary: null } }
  })

  ipcMain.handle('create-qa-subtask', async (_, { issueKey, issueSummary }) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken, project } = loadEnv()
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken || !issueKey) return { error: 'Missing Jira credentials or issue key' }
    return createJiraSubtask({ issueKey, issueSummary, jiraBaseUrl, jiraEmail, jiraApiToken, jiraProject: project })
  })

  ipcMain.handle('ai-generate-bug', async (_, { testCaseKey, testCaseName, cycleKey, whatWentWrong }) => {
    const { anthropicKey, anthropicBaseUrl, token } = loadEnv()
    if (!anthropicKey) return { error: 'ANTHROPIC_AUTH_TOKEN not set in environment' }

    let scenario = ''
    if (token && testCaseKey) {
      try {
        const { zephyrRequest } = require('../lib/zephyrHttp')
        const tc = await zephyrRequest('GET', `/testcases/${encodeURIComponent(testCaseKey)}`, token)
        scenario = tc?.testScript?.text || tc?.objective || ''
        if (!scenario && tc?.testScript?.steps) {
          scenario = (tc.testScript.steps || []).map(s => [s.description, s.testData, s.expectedResult].filter(Boolean).join(' | ')).join('\n')
        }
      } catch (e) {
        console.log('[ai-generate-bug] could not fetch test case from Zephyr:', e.message)
      }
    }

    const prompt =
      'You are a QA engineer writing a structured bug report for Jira after a test case failed.\n\n' +
      'Test case key: ' + testCaseKey + '\n' +
      'Test case name: ' + testCaseName + '\n' +
      (cycleKey ? 'Test cycle: ' + cycleKey + '\n' : '') +
      (scenario ? 'Test case BDD / steps:\n' + scenario + '\n' : '') +
      '\nWhat the QA observed (what went wrong):\n' + whatWentWrong + '\n\n' +
      'Generate a complete bug report. Return JSON (no markdown):\n' +
      '{"summary":"one-line bug title (max 100 chars)","description":"2-3 sentences describing the bug based on what went wrong","stepsToReproduce":"numbered steps derived from the BDD scenario, plain text, one step per line","expectedResult":"what should have happened according to the test case"}'

    try {
      const text = await runClaude(prompt, { anthropicKey, anthropicBaseUrl })
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end <= start) return { error: 'Unexpected response from Claude' }
      const result = JSON.parse(text.slice(start, end + 1))
      return {
        success: true,
        summary: result.summary || '',
        description: result.description || '',
        stepsToReproduce: result.stepsToReproduce || '',
        expectedResult: result.expectedResult || '',
      }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('create-jira-bug', async (_, { summary, description, stepsToReproduce, expectedResult, testCaseKey, cycleKey, type, parentKey }) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken, project } = loadEnv()
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) return { error: 'Missing Jira credentials' }

    const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
    const hostname = parseHostname(jiraBaseUrl)

    const descContent = [
      ...(description ? [adfHeading('Description'), adfParagraph(description)] : []),
      ...(stepsToReproduce ? [
        adfHeading('Steps to Reproduce'),
        adfBulletList(stepsToReproduce.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) || [stepsToReproduce]),
      ] : []),
      ...(expectedResult ? [adfHeading('Expected Result'), adfParagraph(expectedResult)] : []),
      ...(testCaseKey ? [adfHeading('Test Reference'), {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Failed test case: ' },
          { type: 'text', text: testCaseKey, marks: [{ type: 'strong' }] },
          ...(cycleKey ? [{ type: 'text', text: ' (cycle: ' + cycleKey + ')' }] : []),
        ],
      }] : []),
    ]

    const isSubtask = type === 'subtask'
    const fields = {
      project: { key: project },
      summary,
      issuetype: { name: isSubtask ? 'ENG QA Task' : 'Bug' },
      description: { type: 'doc', version: 1, content: descContent },
      ...(isSubtask && parentKey ? { parent: { key: parentKey } } : {}),
    }

    return jiraPost(hostname, auth, JSON.stringify({ fields }))
  })

  ipcMain.handle('import', async (event, testCases) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = loadEnv()
    const resolved = await Promise.all(testCases.map(async tc => {
      if (!tc.assignee) return tc
      const accountId = await resolveJiraAccountId(tc.assignee, jiraBaseUrl, jiraEmail, jiraApiToken)
      return { ...tc, assignee: accountId || tc.assignee }
    }))

    return new Promise((resolve) => {
      const jsonPath = path.join(ROOT, 'test-cases.json')
      fs.writeFileSync(jsonPath, JSON.stringify(resolved, null, 2), 'utf-8')

      const envPath = path.join(ROOT, '.env')
      const envVars = { ...process.env }
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
          const [key, ...rest] = line.split('=')
          if (key && rest.length) envVars[key.trim()] = rest.join('=').trim()
        }
      }

      const jarPattern = path.join(ROOT, 'target', 'qa-notes-*.jar')
      let jarPath
      try {
        jarPath = execSync(`ls ${jarPattern}`).toString().trim().split('\n')[0]
      } catch {
        event.sender.send('import-output', 'ERROR: JAR not found. Run: mvn package -q\n')
        resolve({ success: false, keys: [] })
        return
      }

      const JAVA_CANDIDATES = [
        process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : null,
        '/usr/bin/java',
        '/usr/local/bin/java',
        '/opt/homebrew/opt/openjdk/bin/java',
      ].filter(Boolean)
      const javaBin = JAVA_CANDIDATES.find(p => { try { return fs.existsSync(p) } catch { return false } }) || 'java'

      const proc = spawn(javaBin, ['-jar', jarPath], { env: envVars, cwd: ROOT })
      let fullOutput = ''

      proc.stdout.on('data', (d) => {
        const text = d.toString()
        fullOutput += text
        event.sender.send('import-output', text)
      })
      proc.stderr.on('data', (d) => event.sender.send('import-output', d.toString()))
      proc.on('close', (code) => {
        const project = envVars['JIRA_PROJECT'] || 'DEV'
        const { importedKeys, casesWithResult } = processImportOutput(fullOutput, resolved, project)
        console.log('[import] keys:', importedKeys)
        resolve({ success: code === 0, keys: importedKeys, casesWithResult })
      })
    })
  })

  ipcMain.handle('list-skill-teams', () => {
    const skillsDir = path.join(ROOT, 'skills')
    if (!fs.existsSync(skillsDir)) return []
    return fs.readdirSync(skillsDir).filter(name =>
      fs.statSync(path.join(skillsDir, name)).isDirectory()
    )
  })
}

module.exports = { register }
