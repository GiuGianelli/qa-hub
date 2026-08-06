const { ipcMain, app } = require('electron')
const path = require('path')
const fs = require('fs')

function sessionsPath() {
  return path.join(app.getPath('userData'), 'qa-hub-sessions.json')
}

function readSessions() {
  const p = sessionsPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeSessions(sessions) {
  const p = sessionsPath()
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function register() {
  ipcMain.handle('save-session', (_, session) => {
    const sessions = readSessions()
    sessions.unshift(session)
    writeSessions(sessions)
    return { success: true }
  })

  ipcMain.handle('load-sessions', () => readSessions())

  ipcMain.handle('update-session', (_, session) => {
    writeSessions(readSessions().map(s => s.id === session.id ? session : s))
    return { success: true }
  })

  ipcMain.handle('delete-session', (_, id) => {
    writeSessions(readSessions().filter(s => s.id !== id))
    return { success: true }
  })
}

module.exports = { register }
