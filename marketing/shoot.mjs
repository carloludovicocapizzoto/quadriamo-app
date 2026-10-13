// Schermate per i contenuti social, fatte con i DATI DI ESEMPIO dell'app (nessun dato reale).
// Uso: con il server di sviluppo acceso (npm run dev, porta 5173):  node marketing/shoot.mjs
// Apre Chrome senza finestra come un telefono 375x812 (x2) e salva le immagini in marketing/shots/.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const APP = process.env.APP_URL ?? 'http://localhost:5173/app/'
// OUT_DIR: cartella diversa (es. per il controllo visivo prima/dopo una modifica)
const OUT = process.env.OUT_DIR ? process.env.OUT_DIR.replace(/\/?$/, '/') : new URL('./shots/', import.meta.url).pathname
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

await cdp('Page.enable'); await cdp('Runtime.enable')
// THEME=dark e WIDTH=1024 per il controllo visivo della modalità scura e del computer
const W = Number(process.env.WIDTH ?? 375), WIDE = W > 600
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: WIDE ? 800 : 812, deviceScaleFactor: WIDE ? 1 : 2, mobile: !WIDE })
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.THEME === 'dark' ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
await cdp('Page.navigate', { url: APP }); await sleep(1500)
await js(`localStorage.setItem('quadriamo.lang', '${LANG}')`); await cdp('Page.reload'); await sleep(3500)
await shot('10-welcome.jpg')
await click('Inizia'); await shot('23-install.jpg'); await click('Preferisco continuare nel browser'); await shot('24-login.jpg')
await click('Esplora con dati di esempio'); await sleep(1200)
// il riquadro "dati di esempio" si nasconde con lo stile (toglierlo dalla pagina confonderebbe React)
const clean = `if (!document.getElementById('shot-css')) { const st = document.createElement('style'); st.id = 'shot-css'; st.textContent = '.demo-banner, .consent { display: none !important }'; document.head.append(st) } window.scrollTo(0, 0)`
await shot('11-home.jpg', clean)
await shot('12-home-parts.jpg', scrollTo(`document.querySelector('.today')`))
await js(`document.querySelector('.block').click()`); await sleep(1100); await shot('20-part-sheet.jpg')
await js(`document.querySelector('.bs-root').click()`); await sleep(500)
await click('Analisi', '.tabbar button'); await click('Movimenti', '.segmented button'); await sleep(900); await shot('21-transactions.jpg', clean)
// ricerca: si scrive come farebbe una persona (React riceve l'evento input)
const type = async (sel, text) => { await js(`document.querySelector('${sel}').focus()`); await cdp('Input.insertText', { text }); await sleep(700) }
await type('.search input', 'super'); await shot('28-search.jpg', 'window.scrollTo(0,0)')
await js(`document.querySelector('.search-x').click()`); await sleep(400)
await js(`document.querySelector('.filter-btn').click()`); await sleep(900); await shot('29-filters.jpg')
await js(`[...document.querySelectorAll('.filters .chip')].find(b => b.textContent.includes('Mangiare fuori')).click()`); await sleep(300)
await js(`document.querySelector('.filters .btn.primary').click()`); await sleep(900); await shot('30-filtered.jpg', 'window.scrollTo(0,0)')
await js(`[...document.querySelectorAll('.link-btn')].find(b => b.textContent.includes('Azzera'))?.click()`); await sleep(400)
await click('Analisi', '.tabbar button'); await sleep(2500); await shot('12-forecast.jpg', clean); await shot('13-month.jpg', clean + ';' + scrollTo(`document.querySelector('.part-rows')?.previousElementSibling`))
await click('Anno', '.segmented button'); await sleep(900); await shot('14-trend.jpg', clean)
await shot('15-growing.jpg', scrollTo(`document.querySelector('.part-rows')?.previousElementSibling`))
await click('Investi', '.segmented button'); await sleep(1000); await shot('38-invest.jpg', clean)
// Notizie con contenuti veri (tools/news/sample.json, da: node tools/news/dry-run.ts --sample), senza bisogno del database
try {
  const { readFileSync } = await import('node:fs')
  const sample = readFileSync(new URL('../tools/news/sample.json', import.meta.url), 'utf8')
  await js(`localStorage.setItem('q.hub', JSON.stringify({ lang: '${LANG}', at: Date.now(), items: ${sample}.filter(x => x.lang === '${LANG}' || x.lang === 'en') }))`)
  await click('Notizie', '.tabbar button'); await sleep(1200); await shot('39-news.jpg', clean)
  await shot('40-news-more.jpg', scrollTo(`document.querySelectorAll('.news-section')[3]`))
  await js(`document.querySelector('.story')?.click()`); await sleep(1000); await shot('41-news-detail.jpg')
  await js(`document.querySelector('.bs-root').click()`); await sleep(500)
} catch { console.warn('notizie: manca tools/news/sample.json') }
await click('Profilo', '.tabbar button'); await sleep(900); await shot('17-profile.jpg', clean)
await shot('22-profile-list.jpg', scrollTo(`document.querySelectorAll('.group')[3]`))
await js(`location.hash = '#/profile/progress'`); await sleep(1000); await shot('35-progress.jpg', 'window.scrollTo(0,0)')
await js(`location.hash = '#/profile/personal'`); await sleep(1000)
// una foto profilo, caricata come farebbe una persona (il file passa dal campo "Aggiungi una foto")
{ const { root } = (await cdp('DOM.getDocument')).result; const { nodeId } = (await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '.photo input[type=file]' })).result
  if (nodeId) { await cdp('DOM.setFileInputFiles', { nodeId, files: [new URL('../public/icons/icon-512.png', import.meta.url).pathname] }); await sleep(1200) } }
await shot('36-personal.jpg', 'window.scrollTo(0,0)')
await js(`location.hash = '#/profile/help'`); await sleep(1200); await js(`document.querySelector('.faq details')?.setAttribute('open', '')`); await sleep(300); await shot('37-help.jpg', 'window.scrollTo(0,0)')
await js(`location.hash = '#/profile/goals'`); await sleep(1000); await shot('25-goals.jpg', 'window.scrollTo(0,0)')
await js(`document.querySelector('.goal:not(.goal-add)').click()`); await sleep(1200); await shot('26-goal-detail.jpg')
await js(`document.querySelector('.bs-root').click()`); await sleep(500)
await js(`document.querySelector('.goal-add').click()`); await sleep(900); await shot('27-goal-new.jpg')
await js(`document.querySelector('.bs-root').click()`); await sleep(500)
await js(`document.querySelector('.tab-add').click()`); await sleep(900)
for (const ch of '12,50') { await cdp('Input.insertText', { text: ch }) }
await sleep(300); await shot('16-add.jpg')
// entrata divisa a modo mio: scheda Entrate, prima categoria, "Dividi a modo mio"
await click('Entrate', '.txs-kind button, [role=tab]'); await js(`document.querySelector('.cat-pick button')?.click()`); await sleep(300)
await js(`(() => { const el = [...document.querySelectorAll('.txs-row select')].find(x => [...x.options].some(o => o.value === 'custom')); if (!el) return
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'custom'); el.dispatchEvent(new Event('change', { bubbles: true })) })()`)
await sleep(500); await js(`document.querySelector('.split-edit input')?.scrollIntoView({ block: 'center' })`); await sleep(300); await shot('34-income-split.jpg')
await js(`document.querySelector('.bs-root').click()`); await sleep(500)
// pagamenti ricorrenti: il primo diventa una rata con 8 mesi ancora da pagare
await js(`location.hash = '#/profile/recurring'`); await sleep(1200)
await js(`document.querySelector('.edit-list.recurring li:first-child .unit:nth-child(5) input').focus()`)
await cdp('Input.insertText', { text: '8' }); await sleep(500); await shot('33-recurring.jpg', 'window.scrollTo(0,0)')
// primo avvio senza account: "Chi sei?" e le entrate dello studente
await js(`indexedDB.deleteDatabase('keyval-store'); localStorage.clear(); localStorage.setItem('quadriamo.lang', '${LANG}')`)
await cdp('Page.reload'); await sleep(3000)
await click('Inizia'); await click('Preferisco continuare nel browser'); await click('Continua senza account'); await sleep(1200)
await shot('31-persona.jpg')
await js(`document.querySelector('.persona-card').click()`); await sleep(900)
await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Avanti'))?.click()`); await sleep(900)
await type('.salary-input', '980'); await js(`document.querySelectorAll('.salary-step input')[1].focus()`); await cdp('Input.insertText', { text: '380' }); await sleep(900)
await shot('32-income.jpg', 'window.scrollTo(0,0)')
ws.close(); chrome.kill()
