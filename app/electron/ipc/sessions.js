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

function register() {
  ipcMain.handle('save-session', (_, session) => {
    const sessions = readSessions()
    sessions.unshift(session)
    fs.writeFileSync(sessionsPath(), JSON.stringify(sessions, null, 2), 'utf-8')
    return { success: true }
  })

  ipcMain.handle('load-sessions', () => readSessions())

  ipcMain.handle('update-session', (_, session) => {
    const sessions = readSessions().map(s => s.id === session.id ? session : s)
    fs.writeFileSync(sessionsPath(), JSON.stringify(sessions, null, 2), 'utf-8')
    return { success: true }
  })

  ipcMain.handle('delete-session', (_, id) => {
    const sessions = readSessions().filter(s => s.id !== id)
    fs.writeFileSync(sessionsPath(), JSON.stringify(sessions, null, 2), 'utf-8')
    return { success: true }
  })
}

module.exports = { register }
