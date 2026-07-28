const { ipcMain } = require('electron')
const https = require('https')
const { loadEnv } = require('../lib/env')
const { zephyrRequest } = require('../lib/zephyrHttp')

function register() {
  ipcMain.handle('get-folders', async (_, { folderType }) => {
    const { token, project } = loadEnv()
    if (!token) return []
    try {
      const all = []
      let startAt = 0
      const maxResults = 200
      while (true) {
        const qs = `projectKey=${encodeURIComponent(project)}&folderType=${encodeURIComponent(folderType)}&maxResults=${maxResults}&startAt=${startAt}`
        const json = await zephyrRequest('GET', `/folders?${qs}`, token)
        const values = json.values || []
        all.push(...values.map(f => ({ id: f.id, name: f.name, parentId: f.parentId ?? null })))
        if (json.isLast || values.length < maxResults) break
        startAt += maxResults
      }
      return all
    } catch { return [] }
  })

  ipcMain.handle('get-cycle', async (_, { cycleKey }) => {
    const { token, project } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    try {
      const cycle = await zephyrRequest('GET', `/testcycles/${encodeURIComponent(cycleKey)}`, token)
      let executions = [], statusList = [], statusMap = {}

      try {
        const statuses = await zephyrRequest('GET', `/statuses?projectKey=${encodeURIComponent(project)}&statusType=TEST_EXECUTION&maxResults=100`, token)
        for (const s of (statuses.values || [])) {
          statusMap[s.id] = s.name
          statusList.push({ id: s.id, name: s.name })
        }
      } catch (e) { console.log('[get-cycle] statuses error:', e.message) }

      try {
        const execs = await zephyrRequest('GET', `/testexecutions?projectKey=${encodeURIComponent(project)}&testCycle=${encodeURIComponent(cycleKey)}&maxResults=200`, token)
        function tcKeyFromSelf(self) {
          if (!self) return ''
          const m = String(self).match(/\/testcases\/([\w-]+)\//)
          return m ? m[1] : ''
        }
        executions = (Array.isArray(execs.values) ? execs.values : []).map(e => ({
          id: e.id,
          testCaseKey: tcKeyFromSelf(e.testCase && e.testCase.self),
          testCaseName: '',
          status: (e.testExecutionStatus && statusMap[e.testExecutionStatus.id]) || '',
        }))
      } catch (e) { console.log('[get-cycle] execs error:', e.message) }

      return {
        key: String(cycle.key || cycleKey),
        name: String(cycle.name || ''),
        description: String(cycle.description || ''),
        plannedStartDate: String(cycle.plannedStartDate || ''),
        plannedEndDate: String(cycle.plannedEndDate || ''),
        folder: String((cycle.folder && cycle.folder.name) || ''),
        executions,
        statuses: statusList,
      }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('update-execution', async (_, { executionId, statusName }) => {
    const { token, project } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    try {
      await zephyrRequest('PUT', `/testexecutions/${executionId}`, token, { projectKey: project, statusName })
      return { success: true }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('link-cycle-to-issue', async (_, { cycleKey, issueKey }) => {
    const { token, project, jiraBaseUrl, jiraEmail, jiraApiToken } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }

    const cycle = await zephyrRequest('GET', `/testcycles/${encodeURIComponent(cycleKey)}`, token).catch(e => ({ error: e.message }))
    if (cycle.error) return { error: cycle.error }
    const cycleId = cycle.id
    if (!cycleId) return { error: 'Could not resolve cycle internal ID' }

    let issueId = null
    try {
      const links = await zephyrRequest('GET', `/links?issueKey=${encodeURIComponent(issueKey)}&projectKey=${encodeURIComponent(project)}&maxResults=1`, token)
      const found = (links.values || links || [])[0]
      if (found?.issueId) {
        issueId = Number(found.issueId)
        console.log('[link-cycle-to-issue] resolved issueId via Zephyr links:', issueId)
      }
    } catch (e) {
      console.log('[link-cycle-to-issue] Zephyr links lookup failed:', e.message)
    }

    if (!issueId && jiraBaseUrl && jiraEmail && jiraApiToken) {
      try {
        const hostname = jiraBaseUrl.replace(/^https?:\/\//, '')
        const basicAuth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
        issueId = await new Promise((resolve, reject) => {
          const options = {
            hostname,
            path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=id`,
            method: 'GET',
            headers: { 'Authorization': 'Basic ' + basicAuth, 'Accept': 'application/json' },
          }
          const req = https.request(options, (r) => {
            let b = ''
            r.on('data', c => b += c)
            r.on('end', () => {
              if (r.statusCode >= 200 && r.statusCode < 300) {
                const json = JSON.parse(b)
                resolve(json.id ? Number(json.id) : null)
              } else {
                reject(new Error(`HTTP ${r.statusCode}: ${b}`))
              }
            })
          })
          req.on('error', reject)
          req.end()
        })
        console.log('[link-cycle-to-issue] resolved issueId via Jira API:', issueId)
      } catch (e) {
        console.log('[link-cycle-to-issue] Jira API fallback failed:', e.message)
      }
    }

    const attempts = [
      ...(issueId ? [['POST', `/testcycles/${cycleId}/links/issues`, { issueId }]] : []),
      ['POST', `/testcycles/${cycleId}/links`, { issueKey }],
      ['POST', `/testcycles/${cycleId}/links`, { jiraIssueKey: issueKey }],
    ]

    for (const [method, urlPath, body] of attempts) {
      try {
        console.log(`[link-cycle-to-issue] trying ${method} ${urlPath}`, body)
        const result = await zephyrRequest(method, urlPath, token, body)
        console.log('[link-cycle-to-issue] SUCCESS:', JSON.stringify(result).slice(0, 200))
        return { success: true }
      } catch (e) {
        console.log(`[link-cycle-to-issue] ${method} ${urlPath} failed:`, e.message)
      }
    }

    return { error: 'All link attempts failed — check terminal for details' }
  })

  ipcMain.handle('add-to-cycle', async (_, { cycleKey, testCaseKey }) => {
    const { token, project } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    try {
      const exec = await zephyrRequest('POST', '/testexecutions', token, {
        projectKey: project,
        testCaseKey,
        testCycleKey: cycleKey,
        statusName: 'Not Executed',
      })
      return { success: true, id: exec.id }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('remove-execution', async (_, { executionId }) => {
    const { token } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    try {
      await zephyrRequest('DELETE', `/testexecutions/${executionId}`, token)
      return { success: true }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('zephyr-search-test-cases', async (_, { query }) => {
    const { token, project } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    try {
      function mapTc(tc) {
        return {
          key: tc.key || '',
          name: tc.name || '',
          status: tc.status?.name || '',
          priority: tc.priority?.name || '',
          objective: tc.objective || '',
          precondition: tc.precondition || '',
          productComponent: (tc.customFields?.productComponent) || '',
          squadTeam: (tc.customFields?.squadTeam) || '',
          folderId: tc.folder?.id ? String(tc.folder.id) : '',
        }
      }

      const q = (query || '').trim()
      if (/^[A-Z]+-T\d+$/i.test(q)) {
        const tc = await zephyrRequest('GET', `/testcases/${encodeURIComponent(q.toUpperCase())}`, token)
        if (!tc || tc.error) return { cases: [] }
        return { cases: [mapTc(tc)] }
      }

      const qs = `projectKey=${encodeURIComponent(project)}&maxResults=10` +
        (q ? `&query=${encodeURIComponent(q)}` : '')
      const json = await zephyrRequest('GET', `/testcases?${qs}`, token)
      return { cases: (json.values || []).map(mapTc) }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('create-cycle', (event, { cycleName, description, startDate, endDate, testCaseKeys, folderId }) => {
    return new Promise((resolve) => {
      const { token, project } = loadEnv()
      if (!token) {
        resolve({ success: false, error: 'ZEPHYR_TOKEN not set in .env' })
        return
      }

      async function run() {
        event.sender.send('cycle-output', `Creating cycle "${cycleName}"...\n`)

        const cycleBody = { projectKey: project, name: cycleName }
        if (description) cycleBody.description = description
        if (startDate) cycleBody.plannedStartDate = startDate + 'T00:00:00Z'
        if (endDate) cycleBody.plannedEndDate = endDate + 'T00:00:00Z'
        if (folderId) cycleBody.folderId = folderId

        const cycle = await zephyrRequest('POST', '/testcycles', token, cycleBody)
        const cycleKey = cycle.key
        event.sender.send('cycle-output', `Cycle created: ${cycleKey}\n\n`)

        let ok = 0, fail = 0
        for (let i = 0; i < testCaseKeys.length; i++) {
          const tcKey = testCaseKeys[i]
          try {
            await zephyrRequest('POST', '/testexecutions', token, {
              projectKey: project,
              testCaseKey: tcKey,
              testCycleKey: cycleKey,
              statusName: 'Not Executed',
            })
            event.sender.send('cycle-output', `  [${i + 1}/${testCaseKeys.length}] OK   ${tcKey}\n`)
            ok++
          } catch (e) {
            event.sender.send('cycle-output', `  [${i + 1}/${testCaseKeys.length}] FAIL ${tcKey} -> ${e.message}\n`)
            fail++
          }
        }

        event.sender.send('cycle-output', `\nDone. ${ok} added, ${fail} failed. Cycle: ${cycleKey}\n`)
        return { success: true, cycleKey }
      }

      run().then(resolve).catch(e => {
        event.sender.send('cycle-output', `ERROR: ${e.message}\n`)
        resolve({ success: false, error: e.message })
      })
    })
  })
}

module.exports = { register }
