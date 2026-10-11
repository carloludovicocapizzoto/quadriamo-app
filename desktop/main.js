// Quadriamo per computer (Mac e Windows): una finestra dedicata che apre l'app di Quadriamo.
// I dati restano quelli dell'app (account e sincronizzazione); funziona anche offline dopo la prima apertura.
const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, session, shell } = require('electron')
const { setupUpdates } = require('./updater')

const APP_URL = 'https://carloludovicocapizzoto.github.io/quadriamo-app/app/'
const APP_PREFIX = 'https://carloludovicocapizzoto.github.io/quadriamo-app/'

if (!app.requestSingleInstanceLock()) app.quit()

let win = null
function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 820, minWidth: 380, minHeight: 600,
    title: 'Quadriamo', backgroundColor: '#FAF7F2', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false, preload: path.join(__dirname, 'preload.js') },
  })
  // l'app riconosce la versione per computer (niente tutorial "aggiungi alla Home")
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} QuadriamoDesktop/${app.getVersion()}`)
  win.loadURL(APP_URL)
  win.once('ready-to-show', () => win.show())
  // privacy, termini, email e ogni altro sito si aprono nel browser
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_PREFIX + 'app') && !url.startsWith(APP_PREFIX + 'admin')) { e.preventDefault(); void shell.openExternal(url) }
  })
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
// a ogni nuova versione dell'app per computer si svuota la copia salvata del sito (si riscarica quella aggiornata)
async function freshSiteOnNewVersion() {
  const mark = path.join(app.getPath('userData'), 'last-version.txt')
  let last = ''
  try { last = fs.readFileSync(mark, 'utf8') } catch { /* primo avvio */ }
  if (last === app.getVersion()) return
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }).catch(() => {})
  await session.defaultSession.clearCache().catch(() => {})
  try { fs.writeFileSync(mark, app.getVersion()) } catch { /* niente */ }
}

app.whenReady().then(async () => {
  await freshSiteOnNewVersion()
  createWindow()
  setupUpdates()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
