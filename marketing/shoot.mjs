// Schermate per i contenuti social, fatte con i DATI DI ESEMPIO dell'app (nessun dato reale).
// Uso: con il server di sviluppo acceso (npm run dev, porta 5173):  node marketing/shoot.mjs
// Apre Chrome senza finestra come un telefono 375x812 (x2) e salva le immagini in marketing/shots/.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const APP = process.env.APP_URL ?? 'http://localhost:5173/app/'
const OUT = new URL('./shots/', import.meta.url).pathname
const PORT = 9333
const LANG = process.argv[2] ?? 'it'   // it, en, fr, es
const sleep = ms => new Promise(r => setTimeout(r, ms))

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'qshot-'))}`,
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
const click = async (text, scope = 'button, a, label') => {
  const ok = await js(`(() => { const el = [...document.querySelectorAll('${scope}')].find(b => b.textContent.trim().includes(${JSON.stringify(text)})); if (el) el.click(); return !!el })()`)
  if (!ok) console.warn('non trovato:', text)
  await sleep(900)
}
const shot = async (name, prep = '') => {
  if (prep) { await js(prep); await sleep(700) }
  const { result } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  writeFileSync(join(OUT, name), Buffer.from(result.data, 'base64')); console.log(name)
}
const scrollTo = sel => `(() => { const el = ${sel}; if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12) } })()`
const byText = (tag, text) => `[...document.querySelectorAll('${tag}')].find(x => x.textContent.includes(${JSON.stringify(text)}))`

await cdp('Page.enable'); await cdp('Runtime.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
await cdp('Page.navigate', { url: APP }); await sleep(1500)
await js(`localStorage.setItem('quadriamo.lang', '${LANG}')`); await cdp('Page.reload'); await sleep(3500)
await shot('10-welcome.jpg')
await click('Inizia'); await click('Preferisco continuare nel browser'); await click('Esplora con dati di esempio'); await sleep(1200)
// il riquadro "dati di esempio" si nasconde con lo stile (toglierlo dalla pagina confonderebbe React)
const clean = `if (!document.getElementById('shot-css')) { const st = document.createElement('style'); st.id = 'shot-css'; st.textContent = '.demo-banner, .consent { display: none !important }'; document.head.append(st) } window.scrollTo(0, 0)`
await shot('11-home.jpg', clean)
await shot('12-forecast.jpg', scrollTo(byText('.widget', 'Previsione di fine mese')))
await click('Mese', '.bottom-nav button'); await sleep(1500); await shot('13-month.jpg', clean)
await click('Anno', '.bottom-nav button'); await shot('14-trend.jpg', clean + ';' + scrollTo(byText('.widget', 'Andamento')))
await shot('15-growing.jpg', scrollTo(byText('.widget', 'Categorie che crescono')))
await click('Home', '.bottom-nav button'); await js(clean)
await js(`document.querySelector('.fab').click()`); await sleep(900); await shot('16-add.jpg')
await js(`document.querySelector('dialog[open] .icon-btn, dialog[open] button[aria-label]')?.click()`); await sleep(500)
await click('Opzioni', '.bottom-nav button'); await shot('17-settings.jpg', clean)
ws.close(); chrome.kill()
