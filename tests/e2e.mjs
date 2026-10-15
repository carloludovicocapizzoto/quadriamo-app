// Test che usano l'app come un utente: Chrome senza finestra apre l'app costruita senza server (dati solo sul telefono)
// e fa i percorsi principali. Si ferma al primo passo che non va, o se nella pagina compare un errore.
// Uso: npm run e2e   (costruisce l'app senza server in dist-e2e, la serve sulla porta 4180 e lancia i controlli)
// Chrome: CHROME=/percorso/del/chrome, altrimenti quello del Mac o google-chrome (GitHub Actions).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_APP = process.env.E2E_URL ?? 'http://localhost:4180/app/'
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
  .find(p => existsSync(p)) ?? 'google-chrome'
const PORT = 9444
const sleep = ms => new Promise(r => setTimeout(r, ms))

// il server con l'app costruita (npm run e2e la costruisce in dist-e2e), se non ne è stato indicato un altro
const server = process.env.E2E_URL ? null
  : spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', '4180', '--strictPort'], { stdio: 'ignore', detached: true })
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL_APP)).ok) break } catch { /* non ancora */ } await sleep(250) }

const profile = mkdtempSync(join(tmpdir(), 'qe2e-'))
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--lang=it-IT', 'about:blank'], { stdio: 'ignore' })
const done = async code => {
  try { ws.close() } catch { /* già chiuso */ }
  chrome.kill(); await new Promise(r => chrome.once('exit', r)); try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }) } catch { /* Chrome scrive ancora: la cartella temporanea la pulisce il sistema */ }
  if (server) try { process.kill(-server.pid) } catch { /* già chiuso */ }
  process.exit(code)
}

let target
for (let i = 0; i < 60 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page') } catch { await sleep(250) }
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map(), errors = []
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] ?? 'errore')
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const js = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const type = async text => { for (const ch of text) await cdp('Input.insertText', { text: ch }) }

// un passo del percorso: fa qualcosa e aspetta che la condizione diventi vera (al massimo 6 secondi)
let n = 0
async function step(name, action, check) {
  n++
  if (action) await action()
  for (let i = 0; i < 30; i++) { if (await js(check)) { console.log(`  ✓ ${n}. ${name}`); return } await sleep(200) }
  console.error(`  ✗ ${n}. ${name}\n    condizione non vera: ${check}`)
  await done(1)
}
const click = sel => js(`(() => { const el = ${sel}; el?.click(); return !!el })()`)
const byText = (re, scope = 'button') => `[...document.querySelectorAll('${scope}')].find(b => ${re}.test(b.textContent.trim()))`
const has = (re, scope = 'body') => `${re}.test(document.querySelector('${scope}')?.innerText ?? '')`

await cdp('Page.enable'); await cdp('Runtime.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await cdp('Page.navigate', { url: URL_APP }); await sleep(1500)
await js(`localStorage.setItem('quadriamo.lang', 'it')`); await cdp('Page.reload')

console.log('Primo avvio')
await step('si apre il benvenuto', null, `!!document.querySelector('.gate-cta')`)
await step('Inizia porta alla configurazione', async () => {
  await click(`document.querySelector('.gate-cta')`); await sleep(600)
  await click(byText('/browser/i'))
}, has('/Chi sei/'))
await step('scelgo «Studente fuori sede»', () => click(`document.querySelector('.persona-row')`), `!${has('/Chi sei/')}`)
// i passaggi della configurazione: avanti fino all'app (le scelte di partenza vanno bene)
await step('completo la configurazione', async () => {
  for (let i = 0; i < 14 && !(await js(`!!document.querySelector('.tabbar')`)); i++) {
    await click(`document.querySelector('.step-nav .btn.primary')`); await sleep(500)
  }
}, `!!document.querySelector('.tabbar')`)

console.log('Entrate e spese')
await step('la Home chiede le entrate del mese', null, `!!document.querySelector('.home .empty')`)
await step('registro 1.000 € di entrate', async () => {
  await click(`document.querySelector('.home .empty .btn')`); await sleep(700)
  await type('1000'); await sleep(200)
  await click(`document.querySelector('.cat-pick button')`)
  await click(`document.querySelector('.tx-sheet button[type=submit]')`)
}, `!!document.querySelector('.hero-amount')`)
await step('compare il numero del giorno e le quattro parti', null, `document.querySelectorAll('.block').length === 4`)
await step('segno una spesa di 12,50 €', async () => {
  await click(`document.querySelector('.tab-add')`); await sleep(700)
  await type('12,50'); await sleep(200)
  await click(`document.querySelector('.cat-pick button')`)
  await click(`document.querySelector('.tx-sheet button[type=submit]')`)
}, `/12,50/.test(document.querySelector('.w-today')?.innerText ?? '')`)
await step('dopo aver ricaricato la pagina, la spesa c\'è ancora', () => cdp('Page.reload'), `/12,50/.test(document.querySelector('.w-today')?.innerText ?? '')`)

console.log('Le altre sezioni')
await step('Analisi → Mese mostra come finisce il mese', () => js(`location.hash = '#/analysis/month'`), `!!document.querySelector('.outcome-amount')`)
await step('Analisi → Movimenti elenca la spesa', () => js(`location.hash = '#/analysis/transactions'`), has('/12,50/'))
await step('Notizie si apre senza errori', () => js(`location.hash = '#/news'`), `!!document.querySelector('.news2') && !document.querySelector('[role=status] .btn') || ${has('/Notizie/')}`)
await step('Profilo → Capitale: inserisco 2.000 €', async () => {
  await js(`location.hash = '#/profile/capital'`); await sleep(800)
  await click(`document.querySelector('.empty .btn')`); await sleep(400)
  await js(`document.querySelector('.cap-parts input[inputmode]')?.focus() ?? [...document.querySelectorAll('.cap-parts input')][1]?.focus()`)
  await type('2000'); await sleep(200)
  await click(byText('/Salva il saldo/'))
}, has('/2\\.000,00/', '.outcome'))
await step('il capitale compare in Home', () => js(`location.hash = '#/'`), `/2\\.000,00/.test(document.querySelector('.w-capital')?.innerText ?? '')`)

console.log('Tastiera')
const press = (key, code) => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key.length === 1 ? key : undefined, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) })
await step('G poi N apre le Notizie', async () => { await js(`document.activeElement?.blur()`); await press('g', 'KeyG'); await press('n', 'KeyN') }, `location.hash === '#/news'`)
await step('N apre il nuovo movimento', () => press('n', 'KeyN'), `!!document.querySelector('.tx-sheet')`)
await step('Esc lo chiude', () => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }), `!document.body.classList.contains('sheet-open')`)
await step('? mostra le scorciatoie', async () => { await sleep(600); await press('?', 'Slash') }, `!!document.querySelector('.kb-list')`)

if (errors.length) { console.error(`\nErrori nella pagina:\n  ${errors.join('\n  ')}`); await done(1) }
console.log(`\nTutti i ${n} passi sono andati bene.`)
await done(0)
