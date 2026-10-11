// Aggiornamenti dell'app per computer.
// - Il contenuto di Quadriamo (funzioni, testi, correzioni) arriva dal sito: si aggiorna da solo a ogni avvio.
// - Questo modulo aggiorna la "cornice" (la finestra Electron): controlla le nuove versioni pubblicate su GitHub Releases.
//   Windows: scarica in sottofondo e installa alla chiusura (o subito, se l'utente sceglie "Riavvia ora").
//   Mac: senza firma Apple l'installazione automatica non è possibile, quindi l'app avvisa e apre la pagina di download.
const { app, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')

const DOWNLOAD_PAGE = 'https://carloludovicocapizzoto.github.io/quadriamo-app/inizia.html#mac'
const EVERY_HOURS = 6
const it = () => app.getLocale().startsWith('it')

function setupUpdates() {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = process.platform === 'win32'
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', async info => {
    if (process.platform === 'win32') return   // su Windows scarica da solo; si chiede dopo, a download finito
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: it() ? ['Scarica', 'Più tardi'] : ['Download', 'Later'], defaultId: 0, cancelId: 1,
      message: it() ? `È disponibile Quadriamo ${info.version}` : `Quadriamo ${info.version} is available`,
      detail: it() ? 'Scarica la nuova versione e trascinala nella cartella Applicazioni, sostituendo quella di ora. I tuoi dati restano.'
                   : 'Download the new version and drag it to Applications, replacing the current one. Your data stays.',
    })
    if (response === 0) void shell.openExternal(DOWNLOAD_PAGE)
  })
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: it() ? ['Riavvia ora', 'Alla chiusura'] : ['Restart now', 'When I quit'], defaultId: 0, cancelId: 1,
      message: it() ? `Quadriamo ${info.version} è pronta` : `Quadriamo ${info.version} is ready`,
      detail: it() ? 'L’aggiornamento si installa riavviando l’app. I tuoi dati restano.' : 'The update installs when the app restarts. Your data stays.',
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', () => { /* senza connessione o senza nuove versioni: si riprova più tardi */ })

  const check = () => { autoUpdater.checkForUpdates().catch(() => {}) }
  setTimeout(check, 10_000)
  setInterval(check, EVERY_HOURS * 3600_000)
}

module.exports = { setupUpdates }
