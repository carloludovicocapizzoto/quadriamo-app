// Schermate vere dell'app per il sito (telefono in apertura e "Una giornata con Quadriamo"), con i DATI DI ESEMPIO.
// Uso: node marketing/site-shots.mjs  (server di sviluppo acceso), poi python3 tools/site_images.py
// Uso: con il server di sviluppo acceso (npm run dev, porta 5173):  node marketing/shoot.mjs
// Apre Chrome senza finestra come un telefono 375x812 (x2) e salva le immagini in marketing/shots/.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const APP = process.env.APP_URL ?? 'http://localhost:5173/app/'
// OUT_DIR: cartella diversa (es. per il controllo visivo prima/dopo una modifica)
const OUT = (process.env.OUT_DIR ?? new URL('./site-shots/', import.meta.url).pathname).replace(/\/?$/, '/')
const PORT = 9333
const sleep = ms => new Promise(r => setTimeout(r, ms))

// profilo di Chrome usa e getta: si cancella alla fine (senza, ogni giro lascia centinaia di MB nella cartella temporanea)
const PROFILE = mkdtempSync(join(tmpdir(), 'qshot-'))
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--lang=it-IT', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
let target
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page') } catch { await sleep(200) }
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') console.warn('errore nella pagina:', m.params.exceptionDetails.exception?.description?.split('\n').slice(0, 3).join(' | ')); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const js = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (name, prep = '') => {
  if (prep) { await js(prep); await sleep(700) }
  const { result } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  writeFileSync(join(OUT, name), Buffer.from(result.data, 'base64')); console.log(name)
}

await cdp('Page.enable'); await cdp('Runtime.enable')

await cdp('Page.enable'); await cdp('Runtime.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
const hide = `document.querySelector('.demo-banner')?.remove(); document.querySelector('.consent')?.remove(); window.scrollTo(0,0)`
for (const lang of ['it', 'en', 'fr', 'es']) for (const theme of ['light', 'dark']) {
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  await cdp('Page.navigate', { url: APP }); await sleep(1200)
  await js(`localStorage.clear(); indexedDB.deleteDatabase('keyval-store'); localStorage.setItem('quadriamo.lang', '${lang}')`); await cdp('Page.reload'); await sleep(2500)
  await js(`document.querySelector('.gate-cta')?.click()`); await sleep(900)
  await js(`[...document.querySelectorAll('button')].find(b => /browser|navegador|navigateur/i.test(b.textContent))?.click()`); await sleep(900)
  await js(`[...document.querySelectorAll('button')].find(b => /esempio|sample|exemple|ejemplo/i.test(b.textContent))?.click()`); await sleep(1500)
  const p = `${lang}-${theme}`
  await js(hide); await sleep(300); await shot(`${p}-home.jpg`)
  await js(`document.querySelector('.block')?.click()`); await sleep(900); await shot(`${p}-split.jpg`)
  await js(`document.querySelector('.bs-root')?.click()`); await sleep(600)
  await js(`document.querySelector('.tab-add').click()`); await sleep(900)
  await js(`[...document.querySelectorAll('.txs-kind button, [role=tab]')][1]?.click()`); await sleep(400)
  for (const ch of '750') await cdp('Input.insertText', { text: ch }); await sleep(500); await shot(`${p}-income.jpg`)
  await js(`document.querySelector('.bs-root')?.click()`); await sleep(600)
  await js(`document.querySelector('.tab-add').click()`); await sleep(900)
  for (const ch of '1,20') await cdp('Input.insertText', { text: ch }); await sleep(500); await shot(`${p}-add.jpg`)
  await js(`document.querySelector('.bs-root')?.click()`); await sleep(600)
  await js(`location.hash = '#/profile/progress'`); await sleep(1200); await js(hide); await shot(`${p}-streak.jpg`)
  await js(`location.hash = '#/profile/shared'`); await sleep(1200); await js(hide); await shot(`${p}-shared.jpg`)
  await js(`location.hash = '#/'`); await sleep(600)
}
ws.close(); chrome.kill()
await new Promise(r => chrome.once('exit', r)); rmSync(PROFILE, { recursive: true, force: true })
