const { ipcMain } = require('electron')
const https = require('node:https')
const { loadEnv } = require('../lib/env')
const { runClaude } = require('../lib/claude')

function jiraRequest(method, path, jiraBaseUrl, jiraEmail, jiraApiToken, body) {
  return new Promise((resolve, reject) => {
    const hostname = jiraBaseUrl.replace(/^https?:\/\//, '')
    const basicAuth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Accept': 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }
    const req = https.request(options, (r) => {
      let b = ''
      r.on('data', c => b += c)
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(b ? JSON.parse(b) : {})
        else reject(new Error(`HTTP ${r.statusCode}: ${b.slice(0, 300)}`))
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function register() {
  // Convert natural language to metric definition using Claude
  ipcMain.handle('metrics-generate', async (_, { prompt: userPrompt, project }) => {
    const { anthropicKey, anthropicBaseUrl, jiraBaseUrl, jiraEmail, jiraApiToken } = loadEnv()
    const proj = project || loadEnv().project

    if (!anthropicKey) return { error: 'ANTHROPIC_AUTH_TOKEN not set in environment' }
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) return { error: 'JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN must be set in .env' }

    // Fetch project components and Team field context for Claude
    let components = []
    let teamFieldId = null
    let teamFieldValues = []

    try {
      const compResult = await jiraRequest('GET', `/rest/api/3/project/${encodeURIComponent(proj)}/components`, jiraBaseUrl, jiraEmail, jiraApiToken)
      components = Array.isArray(compResult) ? compResult.map(c => c.name) : []
    } catch (e) {
      console.log('[metrics-generate] could not fetch components:', e.message)
    }

    try {
      // Find the Team field id (Jira Cloud usually exposes it as a custom field)
      const allFields = await jiraRequest('GET', '/rest/api/3/field', jiraBaseUrl, jiraEmail, jiraApiToken)
      const teamField = Array.isArray(allFields) && allFields.find(f =>
        f.name?.toLowerCase() === 'team' || f.name?.toLowerCase() === 'squad'
      )
      if (teamField) {
        teamFieldId = teamField.id  // e.g. "customfield_10001"
        console.log('[metrics-generate] found team field:', teamFieldId)

        // Try to get the actual team values from the field context (createmeta)
        try {
          const meta = await jiraRequest('GET', `/rest/api/3/issue/createmeta/${encodeURIComponent(proj)}/issuetypes`, jiraBaseUrl, jiraEmail, jiraApiToken)
          const issueTypeId = meta?.issueTypes?.[0]?.id
          if (issueTypeId) {
            const fieldMeta = await jiraRequest('GET', `/rest/api/3/issue/createmeta/${encodeURIComponent(proj)}/issuetypes/${issueTypeId}`, jiraBaseUrl, jiraEmail, jiraApiToken)
            const tf = fieldMeta?.fields?.[teamFieldId]
            if (tf?.allowedValues?.length) {
              teamFieldValues = tf.allowedValues.map(v => v.name || v.value || v.id).filter(Boolean)
            }
          }
        } catch (e) {
          console.log('[metrics-generate] could not fetch team field values:', e.message)
        }
      }
    } catch (e) {
      console.log('[metrics-generate] could not fetch fields:', e.message)
    }

    const componentList = components.map(c => '"' + c + '"').join(', ')
    const componentContext = components.length
      ? 'Available project components: ' + componentList
      : 'No components configured in this project.'

    let teamFieldContext = ''
    if (teamFieldId) {
      const jqlAlias = teamFieldId.startsWith('customfield_')
        ? 'cf[' + teamFieldId.replace('customfield_', '') + ']'
        : teamFieldId
      const valuesHint = teamFieldValues.length
        ? ' Known team values: ' + teamFieldValues.map(v => '"' + v + '"').join(', ') + '.'
        : ' Exact team name values are unknown — use the value as the user typed it.'
      teamFieldContext = 'The "Team" field in Jira has ID ' + teamFieldId + ' and JQL alias ' + jqlAlias + '.' + valuesHint + ' Use this field to filter by team: ' + jqlAlias + ' = "Team Name"'
    } else {
      teamFieldContext = 'No "Team" custom field was found. If the user mentions a team, try using component = "name" instead, or omit the team filter and note it in the explanation.'
    }

    const claudePrompt = `You are a Jira Cloud metrics expert. The user wants to track a quality metric using Jira JQL.

User request: "${userPrompt}"

Context:
- Jira Cloud project key: "${proj}"
- ${componentContext}
- ${teamFieldContext}

Metrics in this team are identified by comment tags in tickets. Known comment tag patterns:
- "On Hold because there is dependency from another team"
- "On Hold because there is dependency from another story"
- "On Hold because is missing information"
- "Moved because of priority changes"
- "Reopened due to problems found during test execution"

IMPORTANT: If the user mentions a team name, squad name, or area — look for a matching component in the list above and add component = "matching name" to the JQL. If nothing matches exactly, pick the closest one. If no components exist, try using labels = "team-name" as a fallback.

Return a JSON object (no markdown, just raw JSON):
{
  "name": "short metric name (3-6 words)",
  "description": "one sentence describing what this metric measures",
  "jql": "valid Jira JQL query string",
  "explanation": "one sentence explaining what the JQL counts and why, including which component/team filter was applied if any",
  "filterName": "name for the saved filter in Jira (max 50 chars)"
}

JQL rules:
- Use comment ~ "tag text" to search comment content
- Always scope to project: project = "${proj}"
- Only add sprint filter if the user explicitly mentions "this sprint", "current sprint", or "open sprint" — otherwise do NOT include any sprint clause
- For "on hold" or "blocked" metrics include: statusCategory != Done
- Keep the JQL valid for Jira Cloud
- Example without sprint: project = "${proj}" AND component = "Risk Engineering" AND comment ~ "On Hold because there is dependency from another team"
- Example with sprint (only when user asks): project = "${proj}" AND component = "Risk Engineering" AND comment ~ "On Hold because there is dependency from another team" AND sprint in openSprints()`

    try {
      const text = await runClaude(claudePrompt, { anthropicKey, anthropicBaseUrl })
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) return { error: `Claude returned unexpected response: ${text.slice(0, 200)}` }
      return { success: true, metric: JSON.parse(text.slice(start, end + 1)) }
    } catch (e) {
      return { error: `Claude error: ${e.message}` }
    }
  })

  // Run a JQL query and return the count + sample issues
  ipcMain.handle('metrics-run-jql', async (_, { jql }) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = loadEnv()
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) return { error: 'Jira credentials not set in .env' }

    try {
      const qs = `jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,assignee,priority`
      const result = await jiraRequest('GET', `/rest/api/3/search/jql?${qs}`, jiraBaseUrl, jiraEmail, jiraApiToken)
      const issues = (result.issues || []).map(i => ({
        key: i.key,
        summary: i.fields?.summary || '',
        status: i.fields?.status?.name || '',
        assignee: i.fields?.assignee?.displayName || 'Unassigned',
        priority: i.fields?.priority?.name || '',
      }))
      // new /search/jql endpoint uses cursor pagination — total may be in result.total or result.pagination.total
      const total = result.total ?? result.pagination?.total ?? issues.length
      return { success: true, total, issues }
    } catch (e) {
      return { error: `Jira search error: ${e.message}` }
    }
  })

  // Save a filter in Jira
  ipcMain.handle('metrics-save-filter', async (_, { name, jql, description }) => {
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = loadEnv()
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) return { error: 'Jira credentials not set in .env' }

    try {
      const result = await jiraRequest('POST', '/rest/api/3/filter', jiraBaseUrl, jiraEmail, jiraApiToken, {
        name,
        description: description || '',
        jql,
        favourite: true,
      })
      return { success: true, filterId: result.id, filterName: result.name, shareUrl: result.viewUrl || '' }
    } catch (e) {
      return { error: `Failed to save filter: ${e.message}` }
    }
  })
}

module.exports = { register }
