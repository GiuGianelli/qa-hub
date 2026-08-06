const { ipcMain } = require('electron')
const { spawn } = require('child_process')
const { loadEnv } = require('../lib/env')
const { zephyrRequest } = require('../lib/zephyrHttp')

const REPO_PATH = '/Users/giullianopiresgianelli/paywithmybank'

// Cached scan result — grep over a large monorepo is expensive
let scanCache = null

// Grep for all DEV-T key patterns across the repos
function scanRepoKeys() {
  return new Promise((resolve) => {
    if (scanCache) return resolve(scanCache)

    // Single alternation pattern covering all known annotation styles
    const pattern = [
      '@TestCaseKey=DEV-T[0-9]+',
      '@Tag\\("DEV-T[0-9]+"\\)',
      '@DisplayName\\("DEV-T[0-9]+"\\)',
      'DEV_T[0-9]+_',
      'TestCaseKey=DEV-T[0-9]+',
    ].join('|')

    const keyRegex = /DEV[_-]T(\d+)/i
    const result = {}

    const grep = spawn('grep', [
      '-rn', '-E', '--include=*.java', '--include=*.feature',
      '--include=*.kt', '--include=*.groovy',
      pattern, REPO_PATH,
    ])

    let buf = ''
    grep.stdout.on('data', chunk => { buf += chunk.toString() })
    grep.stderr.on('data', () => {}) // suppress permission errors

    grep.on('close', () => {
      for (const line of buf.split('\n')) {
        if (!line.trim()) continue
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) continue
        // format: filepath:linenum:content  (grep -n gives line numbers)
        const rest = line.slice(colonIdx + 1)
        const secondColon = rest.indexOf(':')
        if (secondColon === -1) continue
        const filePath = line.slice(0, colonIdx)
        const lineNum = rest.slice(0, secondColon)
        const content = rest.slice(secondColon + 1)

        const match = keyRegex.exec(content)
        if (!match) continue
        const key = `DEV-T${match[1]}`

        if (!result[key]) result[key] = { files: [], lineNum: null }
        // keep shortest relative path for display
        const rel = filePath.replace(REPO_PATH + '/', '')
        if (!result[key].files.includes(rel)) {
          result[key].files.push(rel)
        }
        if (!result[key].lineNum) result[key].lineNum = lineNum
      }
      scanCache = result
      resolve(result)
    })

    grep.on('error', () => resolve({}))
  })
}

function register() {
  ipcMain.handle('scan-repo-keys', async () => {
    try {
      const result = await scanRepoKeys()
      return { success: true, keys: result, total: Object.keys(result).length }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('clear-scan-cache', async () => {
    scanCache = null
    return { success: true }
  })

  ipcMain.handle('get-folder-test-cases', async (_, { folderId, projectKey }) => {
    const { token, project } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    const proj = projectKey || project
    try {
      // Fetch status map: id -> name
      const statusMap = {}
      const statusJson = await zephyrRequest('GET', `/statuses?projectKey=${encodeURIComponent(proj)}&statusType=TEST_CASE&maxResults=200`, token)
      for (const s of statusJson.values || []) {
        statusMap[s.id] = s.name
      }

      const all = []
      let startAt = 0
      const maxResults = 100
      while (true) {
        const qs = [
          `projectKey=${encodeURIComponent(proj)}`,
          folderId ? `folderId=${encodeURIComponent(folderId)}` : '',
          `maxResults=${maxResults}`,
          `startAt=${startAt}`,
        ].filter(Boolean).join('&')
        const json = await zephyrRequest('GET', `/testcases?${qs}`, token)
        const values = json.values || []
        for (const tc of values) {
          const cf = tc.customFields || {}
          const automatedStatus =
            cf['Test Automation'] ||
            cf['testAutomation'] ||
            cf['Automated'] ||
            cf['automation'] ||
            tc.automatedStatus ||
            ''
          const statusId = tc.status?.id
          const statusName = statusId ? (statusMap[statusId] || '') : (tc.status?.name || '')
          all.push({
            key: tc.key,
            name: tc.name || '',
            status: statusName,
            automatedStatus,
            folder: tc.folder?.name || '',
            folderId: tc.folder?.id || null,
          })
        }
        if (json.isLast || values.length < maxResults) break
        startAt += maxResults
      }
      return { success: true, testCases: all }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('get-zephyr-folders-for-coverage', async () => {
    const { token, project } = loadEnv()
    if (!token) return { error: 'ZEPHYR_TOKEN not set' }
    try {
      const all = []
      let startAt = 0
      const maxResults = 200
      while (true) {
        const qs = `projectKey=${encodeURIComponent(project)}&folderType=TEST_CASE&maxResults=${maxResults}&startAt=${startAt}`
        const json = await zephyrRequest('GET', `/folders?${qs}`, token)
        const values = json.values || []
        all.push(...values.map(f => ({ id: f.id, name: f.name, parentId: f.parentId ?? null })))
        if (json.isLast || values.length < maxResults) break
        startAt += maxResults
      }
      return { success: true, folders: all }
    } catch (e) {
      return { error: e.message }
    }
  })
}

module.exports = { register }
