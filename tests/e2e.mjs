// Test che usano l'app come un utente: Chrome senza finestra apre l'app costruita senza server (dati solo sul telefono)
// e fa i percorsi principali. Si ferma al primo passo che non va, o se nella pagina compare un errore.
// Uso: npm run e2e   (costruisce l'app senza server in dist-e2e, la serve sulla porta 4180 e lancia i controlli)
import { spawn } from 'node:child_process'
import { openChrome, sleep } from '../tools/chrome.mjs'

const URL_APP = process.env.E2E_URL ?? 'http://localhost:4180/app/'

// il server con l'app costruita (npm run e2e la costruisce in dist-e2e), se non ne è stato indicato un altro
const server = process.env.E2E_URL ? null
  : spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', '4180', '--strictPort'], { stdio: 'ignore', detached: true })
for (let i = 0; i < 120; i++) { try { if ((await fetch(URL_APP)).ok) break } catch { /* non ancora */ } await sleep(250) }

const errors = []
let chrome
const done = async code => {
  await chrome?.close()
  if (server) try { process.kill(-server.pid) } catch { /* già chiuso */ }
  process.exit(code)
}
try { chrome = await openChrome({ port: 9444, args: ['--lang=it-IT'], waitMs: 45_000, onError: e => errors.push(e) }) } catch (e) { console.error(e.message); await done(1) }
const { cdp, js } = chrome
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
// il salvataggio sul dispositivo parte appena la schermata si aggiorna: una persona non ricarica nello stesso istante
await step('dopo aver ricaricato la pagina, la spesa c\'è ancora', async () => { await sleep(500); await cdp('Page.reload') }, `/12,50/.test(document.querySelector('.w-today')?.innerText ?? '')`)

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
await step('il capitale compare in Analisi → Investi', () => js(`location.hash = '#/analysis/investments'`), `/2\\.000,00/.test(document.querySelector('.cap-line')?.innerText ?? '')`)

console.log('Calendario')
await step('Analisi → Calendario: creo una bolletta mensile', async () => {
  await js(`location.hash = '#/analysis/calendar'`); await sleep(800)
  await click(byText('/Nuovo evento/'))
  await sleep(700)
  await js(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    const f = document.querySelector('.event-form'); set(f.querySelector('input:not([type])'), 'Luce e gas') })()`)
  await click(`document.querySelector('.event-form input[inputmode]')`); await js(`document.querySelector('.event-form input[inputmode]').focus()`); await type('45')
  await click(byText('/Aggiungi al calendario/'))
}, `/Luce e gas/.test(document.querySelector('.calendar')?.innerText ?? '')`)
await step('l\'agenda la mostra anche il mese prossimo', () => click(byText('/^Agenda$/')),
  `(document.querySelector('.calendar')?.innerText.match(/Luce e gas/g) ?? []).length >= 2`)
await step('Profilo → Centro notifiche: una notifica arrivata si archivia', async () => {
  // Fixture nel namespace locale corrente; una vecchia notifica globale rimane esclusa.
  await js(`new Promise(ok => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => { const tx = r.result.transaction('keyval', 'readwrite');
    const store = tx.objectStore('keyval'); const keys = store.getAllKeys(); keys.onsuccess = () => {
      const key = keys.result.find(k => typeof k === 'string' && k.startsWith('quadriamo.data.v2/') && JSON.parse(decodeURIComponent(k.slice('quadriamo.data.v2/'.length)))[2] === 'local');
      if (!key) throw Error('missing local cache');
      const inboxKey = 'q.v2/' + key.slice('quadriamo.data.v2/'.length) + '/quadriamo.inbox';
      store.put([{ id: 'legacy-A', at: new Date().toISOString(), kind: 'message', title: 'PRIVATE-LEGACY-A', body: '', url: './app/' }], 'quadriamo.inbox');
      store.put([{ id: 'e2e', at: new Date().toISOString(), kind: 'reminder', title: 'Domani: Luce e gas', body: '62,00 €', url: './app/' }], inboxKey) }; tx.oncomplete = ok } })`)
  await js(`location.hash = '#/profile/inbox'`); await sleep(800)
  if (await js(`document.body.innerText.includes('PRIVATE-LEGACY-A')`)) throw Error('legacy inbox exposed')
  await click(`document.querySelector('.nc-more')`); await sleep(500)
  await click(byText('/^Archivia$/', '.bs-body button'))
}, `!document.querySelector('.nc-list') && ${has('/Nessuna notifica/')}`)

console.log('Abbonamenti, documenti, ricevuta')
// imposta il valore di un campo come lo farebbe React (evento input), poi lo conferma (change)
const setField = (sel, v) => js(`(() => { const el = document.querySelector('${sel}'); if (!el) return false
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, ${JSON.stringify(v)})
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
const inDays = n => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
await step('Profilo → Abbonamenti: aggiungo Netflix dal catalogo', async () => {
  await js(`location.hash = '#/profile/recurring'`); await sleep(800)
  await click(byText('/Aggiungi abbonamento/')); await sleep(700)
  await setField('.sp input[type=search]', 'net'); await sleep(400)
  await click(`document.querySelector('.sp-list .row')`); await sleep(900)
  await js(`document.querySelector('.event-form input[inputmode=decimal]').focus()`); await type('12,99')
  await setField('.event-form input[type=date]', inDays(5))   // non oggi: «Oggi» in Home resta quello che hai speso
  await click(byText('/Aggiungi al calendario/', '.event-form button'))
}, `/Netflix/.test(document.querySelector('.subs-list')?.innerText ?? '') && /12,99/.test(document.querySelector('.subs-list')?.innerText ?? '')`)
await step('cambiando il prezzo, l\'aumento resta nello storico', async () => {
  await sleep(600)
  await click(`[...document.querySelectorAll('.subs-list .row')].find(r => /Netflix/.test(r.textContent))`); await sleep(900)
  await setField('.event-form input[inputmode=decimal]', '17,99'); await sleep(200)
  await click(byText('/^Salva$/', '.event-form button'))
}, `/[+]38%/.test(document.querySelector('.subs-list')?.innerText ?? '')`)
await step('Costo annuale: «Prova senza» mostra quanto risparmieresti', async () => {
  await js(`location.hash = '#/profile/yearCost'`); await sleep(1000)
  await click(`document.querySelector('.yc-tile')`); await sleep(900)
  await click(byText('/Prova senza/', '.bs-body button'))
}, `!!document.querySelector('.yc-saved')`)
await step('Profilo → Documenti: la patente scade tra 20 giorni', async () => {
  await js(`location.hash = '#/profile/documents'`); await sleep(800)
  await click(byText('/Aggiungi documento/')); await sleep(700)
  await click(byText('/^Auto$/', '.event-form [role=radio]'))
  await click(byText('/^Patente$/', '.doc-preset'))
  await setField('.event-form input[type=date]', inDays(20))
  await click(byText('/^Aggiungi documento$/', '.event-form button'))
}, has('/Tra 20 giorni/'))
await step('Home → «Adesso» ricorda la patente', () => js(`location.hash = '#/'`), `/Patente/.test(document.querySelector('.now')?.innerText ?? '')`)
await step('Analisi → Mese → Ricevuta del mese', async () => {
  await js(`location.hash = '#/analysis/month'`); await sleep(1000)
  await click(byText('/Ricevuta del mese/'))
}, `/RESTA PER ORA/.test(document.querySelector('.rc-paper')?.innerText ?? '')`)
await step('Centro assistenza: le risposte sulle funzioni nuove', async () => {
  await js(`document.querySelector('.bs-root.open')?.click()`); await sleep(500)
  await js(`location.hash = '#/profile/help'`)
}, has('/Cos.è «Adesso»[?]/'))

console.log('Lingua')
await step('Profilo → Lingua → English: l\'app passa all\'inglese', async () => {
  await js(`location.hash = '#/profile/language'`); await sleep(800)
  await click(byText('/^English/', '.row, button, [role=button]'))
}, `document.documentElement.lang === 'en' && /Language|Profile/.test(document.body.innerText)`)
await step('e torna all\'italiano', () => click(byText('/^Italiano/', '.row, button, [role=button]')),
  `document.documentElement.lang === 'it' && /Lingua|Profilo/.test(document.body.innerText)`)

console.log('Installazione e aggiornamenti')
await step('il service worker è registrato (app installabile, aggiornamenti automatici)', null,
  `navigator.serviceWorker.getRegistration().then(r => !!r?.active)`)
await step('senza rete l\'app si riapre lo stesso, con i dati', async () => {
  await cdp('Network.enable'); await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await js(`location.hash = '#/'`); await cdp('Page.reload'); await sleep(1500)
}, `/12,50/.test(document.querySelector('.w-today')?.innerText ?? '')`)
await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

console.log('Tastiera')
const press = (key, code) => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key.length === 1 ? key : undefined, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) })
await step('G poi N apre le Notizie', async () => { await js(`document.activeElement?.blur()`); await press('g', 'KeyG'); await press('n', 'KeyN') }, `location.hash === '#/news'`)
await step('N apre il nuovo movimento', () => press('n', 'KeyN'), `!!document.querySelector('.tx-sheet')`)
await step('Esc lo chiude', () => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }), `!document.body.classList.contains('sheet-open')`)
await step('? mostra le scorciatoie', async () => { await sleep(600); await press('?', 'Slash') }, `!!document.querySelector('.kb-list')`)

if (errors.length) { console.error(`\nErrori nella pagina:\n  ${errors.join('\n  ')}`); await done(1) }
console.log(`\nTutti i ${n} passi sono andati bene.`)
await done(0)
