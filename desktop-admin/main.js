// Quadriamo Admin (Mac e Windows): finestra dedicata all'area amministratore (…/admin/).
// Il contenuto arriva dal sito e si aggiorna da solo. L'app è solo per l'amministratore: non è pubblicata da nessuna parte,
// i file di installazione si consegnano a mano (nuove versioni comprese).
const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, session, shell } = require('electron')

const ADMIN_URL = 'https://carloludovicocapizzoto.github.io/quadriamo-app/admin/'
const ADMIN_PREFIX = 'https://carloludovicocapizzoto.github.io/quadriamo-app/admin'

if (!app.requestSingleInstanceLock()) app.quit()

let win = null
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600,
    title: 'Quadriamo Admin', backgroundColor: '#FAF7F2', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  })
  win.loadURL(ADMIN_URL)
  win.once('ready-to-show', () => win.show())
  // Supabase, GitHub, privacy e ogni altro sito si aprono nel browser
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ADMIN_PREFIX)) { e.preventDefault(); void shell.openExternal(url) } })
}

// a ogni nuova versione si svuota la copia salvata del sito (si riscarica quella aggiornata)
async function freshSiteOnNewVersion() {
  const mark = path.join(app.getPath('userData'), 'last-version.txt')
  let last = ''
  try { last = fs.readFileSync(mark, 'utf8') } catch { /* primo avvio */ }
  if (last === app.getVersion()) return
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }).catch(() => {})
  await session.defaultSession.clearCache().catch(() => {})
  try { fs.writeFileSync(mark, app.getVersion()) } catch { /* niente */ }
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
app.whenReady().then(async () => {
  await freshSiteOnNewVersion()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
