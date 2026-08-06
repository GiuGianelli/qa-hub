const { app, BrowserWindow } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  require('./ipc/misc').register()
  require('./ipc/zephyr').register()
  require('./ipc/reports').register()
  require('./ipc/ai').register()
  require('./ipc/sessions').register()
  require('./ipc/featureWriter').register()
  require('./ipc/metrics').register()
  require('./ipc/coverage').register()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
