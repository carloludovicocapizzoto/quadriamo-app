// Test che usano l'app come un utente: Chrome senza finestra apre l'app costruita senza server (dati solo sul telefono)
// e fa i percorsi principali. Si ferma al primo passo che non va, o se nella pagina compare un errore.
// Uso: npm run e2e   (costruisce l'app senza server in dist-e2e, la serve sulla porta 4180 e lancia i controlli)
import { spawn } from 'node:child_process'
import { openChrome, sleep } from '../tools/chrome.mjs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

const URL_APP = process.env.E2E_URL ?? 'http://localhost:4180/app/'
const screenshotDir = process.env.E2E_SCREENSHOT_DIR
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true })

// il server con l'app costruita (npm run e2e la costruisce in dist-e2e), se non ne è stato indicato un altro
const server = process.env.E2E_URL ? null
  : spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', '4180', '--strictPort'], { stdio: 'ignore', detached: true })
for (let i = 0; i < 120; i++) { try { if ((await fetch(URL_APP)).ok) break } catch { /* non ancora */ } await sleep(250) }

const errors = []
const fixtureDir = mkdtempSync(join(tmpdir(), 'quadriamo-xlsx-test-'))
let chrome
const done = async code => {
  await chrome?.close()
  if (server) try { process.kill(-server.pid) } catch { /* già chiuso */ }
  rmSync(fixtureDir, { recursive: true, force: true })
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
  const page = await js(`(document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 900)`).catch(() => '')
  console.error(`  ✗ ${n}. ${name}\n    condizione non vera: ${check}\n    pagina: ${page}`)
  await done(1)
}
const click = sel => js(`(() => { const el = ${sel}; el?.click(); return !!el })()`)
const clickNative = async selector => {
  const root = await cdp('DOM.getDocument')
  const node = await cdp('DOM.querySelector', { nodeId: root.result.root.nodeId, selector })
  if (!node.result.nodeId) return false
  // al centro dello schermo: appena dentro il bordo, il pulsante può stare sotto la barra in basso (fissa) e il clic la colpirebbe
  await js(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' })`); await sleep(150)
  const box = await cdp('DOM.getBoxModel', { nodeId: node.result.nodeId })
  const q = box.result.model.content, x = (q[0] + q[2] + q[4] + q[6]) / 4, y = (q[1] + q[3] + q[5] + q[7]) / 4
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  return true
}
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

console.log('Importi incollati (P1.1)')
// incolla vero: appunti del sistema e comando «incolla» di Chrome, nel campo importo del nuovo movimento
await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: new URL(URL_APP).origin })
await cdp('Page.bringToFront')
const pasteAmount = async text => {
  await js(`navigator.clipboard.writeText(${JSON.stringify(text)})`)
  await js(`(() => { const el = document.querySelector('.tx-sheet .amount-input'); el.focus(); el.select() })()`)
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'v', code: 'KeyV', modifiers: 4, commands: ['paste'] })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', modifiers: 4 })
  await sleep(250)
}
const amountField = `document.querySelector('.tx-sheet .amount-input')`
await step('incollo «2.35» in italiano: diventa 2,35, non 235', async () => {
  await click(`document.querySelector('.tab-add')`); await sleep(700)
  await js(`navigator.clipboard.writeText('0')`); await sleep(100)                  // appunti pronti prima del primo incolla
  await pasteAmount('2.35')
}, `${amountField}?.value === '2,35' && ${amountField}?.getAttribute('aria-invalid') !== 'true'`)
await step('incollo «1,234.56»: 1.234,56', () => pasteAmount('1,234.56'), `${amountField}?.value === '1.234,56'`)
await step('incollo «0.123»: resta visibile, segnato come non valido, e non si salva', async () => {
  await pasteAmount('0.123')
  await click(`document.querySelector('.cat-pick button')`)
  await click(`document.querySelector('.tx-sheet button[type=submit]')`); await sleep(300)
}, `${amountField}?.value === '0.123' && ${amountField}?.getAttribute('aria-invalid') === 'true' && !!document.querySelector('.tx-sheet')`)
await step('scrivo «2.35» tasto per tasto, dopo aver selezionato tutto: 2,35', async () => {
  await js(`(() => { const el = ${amountField}; el.focus(); el.select() })()`)
  for (const ch of '2.35') await cdp('Input.insertText', { text: ch })
  await sleep(200)
}, `${amountField}?.value === '2,35'`)
await step('chiudo senza salvare: nessun movimento da 235', async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(500)
}, `!document.querySelector('.tx-sheet') && !/235/.test(document.querySelector('.w-today')?.innerText ?? '')`)

console.log('Le altre sezioni')
await step('Analisi → Mese mostra come finisce il mese', () => js(`location.hash = '#/analysis/month'`), `!!document.querySelector('.outcome-amount')`)
await step('Analisi → Movimenti elenca la spesa', () => js(`location.hash = '#/analysis/transactions'`), has('/12,50/'))
await step('Notizie si apre senza errori', () => js(`location.hash = '#/news'`), `!!document.querySelector('.news2') && !document.querySelector('[role=status] .btn') || ${has('/Notizie/')}`)

// Notizie complete (immagini, filtri, sezioni) con contenuti inventati, messi nella memoria del telefono come se li avesse
// appena scaricati: senza server l'app usa quelli. Fonti, link e immagini sono di prova (example.test, immagini data:).
const thumb = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="${color}"/></svg>`)}`
const hoursAgo = h => new Date(Date.now() - h * 3600e3).toISOString()
const newsItem = (id, x) => ({ id, title: `Titolo di prova ${id}`, excerpt: `Estratto di prova ${id}.`, link: `https://example.test/${id}`, thumb: null,
  published: hoursAgo(3), lang: 'it', format: 'article', categories: ['economy'], level: 'intermediate', minutes: 4, relevance: 0.7, cluster: null, crypto: false,
  source: { name: `Fonte ${id}`, kind: 'press', paywall: false, trust: 4, country: 'IT' }, ...x })
const hub = [
  newsItem('oggi1', { title: 'Tassi BCE fermi: cosa cambia per il mutuo', thumb: thumb('#3a6'), categories: ['personal'] }),
  newsItem('oggi2', { title: 'Inflazione di ottobre in calo', thumb: thumb('#36a'), published: hoursAgo(5) }),
  newsItem('video1', { title: 'Video di prova sugli ETF', format: 'video', thumb: thumb('#a63'), categories: ['etf'], source: { name: 'Canale di prova', kind: 'video', paywall: false, trust: 4, country: 'IT' } }),
  newsItem('pod1', { title: 'Podcast di prova sul risparmio', format: 'podcast', thumb: thumb('#a36'), categories: ['saving'], source: { name: 'Podcast di prova', kind: 'podcast', paywall: false, trust: 4, country: 'IT' } }),
  newsItem('ric1', { title: 'Ricerca di prova sui consumi', format: 'research', published: hoursAgo(48), source: { name: 'Istituto di prova', kind: 'research', paywall: false, trust: 5, country: 'EU' } }),
]
const newsBtn = `document.querySelector('.news2 [aria-haspopup=dialog]')`
const loadedThumbs = sel => `[...document.querySelectorAll('${sel}')].filter(i => i.complete && i.naturalWidth > 0).length`
await step('Notizie: le sezioni (Oggi, Video, Podcast, Nuove ricerche)', async () => {
  await js(`localStorage.setItem('q.hub', ${JSON.stringify(JSON.stringify({ lang: 'it', at: Date.now(), items: hub }))}); localStorage.removeItem('q.newsFilter'); location.hash = '#/'`)
  await sleep(300); await js(`location.hash = '#/news'`)
}, `(() => { const t = [...document.querySelectorAll('.news-section .sec-title')].map(h => h.textContent.trim()); return ['Oggi', 'Video', 'Podcast', 'Nuove ricerche'].every(x => t.includes(x)) })()`)
await step('Notizie: le immagini delle fonti si vedono', null, `${loadedThumbs('.news2 img.story-thumb')} >= 4`)
await step('Notizie: Filtri apre il pannello con tipo, argomenti, lingua, area, fonte e ordine', () => click(newsBtn),
  `document.querySelectorAll('.news-filters-panel .nf-group').length === 6`)
await step('Notizie: filtro «Video» → solo il video, e il pulsante conta il filtro', async () => {
  await click(byText('/^Video$/', '.news-filters-panel button')); await sleep(150)
  await click(byText('/Applica filtri/', '.news-filters-panel button'))
}, `(() => { const t = [...document.querySelectorAll('.news2 .story-title')].map(x => x.textContent); return t.length === 1 && t[0] === 'Video di prova sugli ETF' && /1/.test(${newsBtn}?.textContent ?? '') })()`)
await step('Notizie: Reimposta riporta le sezioni', async () => {
  await click(newsBtn); await sleep(400)
  await click(byText('/Reimposta/', '.news-filters-panel button')); await sleep(150)
  await click(byText('/Applica filtri/', '.news-filters-panel button'))
}, `document.querySelectorAll('.news2 .news-section').length >= 5 && !/\\d/.test(${newsBtn}?.textContent ?? '')`)
await step('Notizie: una storia apre il dettaglio con immagine, estratto e link alla fonte', async () => {
  await sleep(300); await click(byText('/Tassi BCE fermi/', '.news2 button.story'))
}, `(() => { const d = document.querySelector('.story-detail'); return !!d && ${loadedThumbs('.story-detail img.story-hero')} === 1
  && /Estratto di prova oggi1/.test(d.innerText) && d.querySelector('a.btn')?.getAttribute('href') === 'https://example.test/oggi1' })()`)
await step('Notizie: chiudo il dettaglio e tolgo i contenuti di prova', async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(500)
  await js(`['q.hub', 'q.newsFilter', 'q.interests'].forEach(k => localStorage.removeItem(k))`)
}, `!document.querySelector('.story-detail')`)
await step('Profilo → Capitale: inserisco 2.000 €', async () => {
  await js(`location.hash = '#/profile/capital'`); await sleep(800)
  await click(byText('/Inserisci il saldo/', '.row')); await sleep(400)
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
await step('Home offre un accesso diretto alla gestione delle ricorrenze', async () => {
  await js(`location.hash = '#/'`); await sleep(700)
}, `/Gestisci abbonamenti e ricorrenti/.test(document.querySelector('.w-upcoming')?.innerText ?? '')`)
await step('il collegamento Home apre abbonamenti e ricorrenti', async () => {
  await click(`document.querySelector('.w-upcoming .link-btn')`); await sleep(700)
}, `location.hash === '#/profile/recurring' && !!document.querySelector('.subs-list')`)
await step('una bolletta bimestrale finita mostra stima, rate previste e data finale', async () => {
  await click(byText('/Aggiungi un pagamento/')); await sleep(500)
  await click(byText('/^Bolletta$/', '.event-form [role=radio]'))
  await setField('.event-form input:not([type])', 'QA-B-Bolletta variabile')
  await setField('.event-form input[inputmode=decimal]', '100')
  await setField('.event-form input[type=date]', inDays(3))
  await click(byText('/^Ogni 2 mesi$/', '.event-form [role=radio]'))
  await click(byText('/Dopo un numero di volte/', '.event-form [role=radio]'))
  await setField('.event-form input[type=number]', '6')
  await click(byText('/Aggiungi al calendario/', '.event-form button'))
}, `/QA-B-Bolletta variabile/.test(document.querySelector('.group-list:not(.subs-list)')?.innerText ?? '') && /stima/.test(document.querySelector('.group-list:not(.subs-list)')?.innerText ?? '') && /50,00/.test(document.querySelector('.group-list:not(.subs-list)')?.innerText ?? '') && /600,00/.test(document.querySelector('.group-list:not(.subs-list)')?.innerText ?? '') && /6 rimaste/.test(document.querySelector('.group-list:not(.subs-list)')?.innerText ?? '') && /fino al/.test(document.querySelector('.group-list:not(.subs-list)')?.innerText ?? '')`)
await step('la ricerca Google AI Pro riconosce un solo servizio Google Gemini', async () => {
  await click(byText('/Aggiungi abbonamento/')); await sleep(500)
  await click(byText('/^Intelligenza artificiale$/', '.sp-cats [role=tab]'))
  await setField('.sp input[type=search]', 'Google AI Pro'); await sleep(300)
}, `/Google Gemini/.test(document.querySelector('.sp-list li:first-child')?.innerText ?? '') && document.querySelectorAll('.sp-list li').length === 2`)
await step('il modulo permette di personalizzare il nome del piano AI', async () => {
  await click(`document.querySelector('.sp-list li:first-child .row')`); await sleep(500)
}, `document.querySelector('.event-form input:not([type])')?.value === 'Google Gemini' && /personalizzare/.test(document.querySelector('.event-form')?.innerText ?? '')`)
await step('il servizio AI generico si può personalizzare e salvare', async () => {
  await js(`document.querySelector('.bs-root.open')?.click()`); await sleep(500)
  await click(`document.querySelector('.subs-list > li:last-child button')`); await sleep(500)
  await click(byText('/^Intelligenza artificiale$/', '.sp-cats [role=tab]'))
  await click(`document.querySelector('.sp-grid li:first-child button')`); await sleep(500)
  await setField('.event-form input:not([type])', 'QA-B-Assistente personale')
  await setField('.event-form input[inputmode=decimal]', '1,50')
  await setField('.event-form input[type=date]', inDays(10))
  await click(byText('/Aggiungi al calendario/', '.event-form button'))
}, `/QA-B-Assistente personale/.test(document.querySelector('.subs-list')?.innerText ?? '') && /1,50/.test(document.querySelector('.subs-list')?.innerText ?? '')`)
await step('un servizio fuori catalogo resta aggiungibile con un nome scelto dall’utente', async () => {
  await click(byText('/Aggiungi abbonamento/')); await sleep(500)
  await setField('.sp input[type=search]', 'QA-B-Servizio personale'); await sleep(300)
  await click(`document.querySelector('.sp-list li:last-child .row')`); await sleep(500)
  await setField('.event-form input[inputmode=decimal]', '2')
  await setField('.event-form input[type=date]', inDays(12))
  await click(byText('/Aggiungi al calendario/', '.event-form button'))
}, `/QA-B-Servizio personale/.test(document.querySelector('.subs-list')?.innerText ?? '')`)
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

console.log('Categorie')
// eliminare una categoria usata non cancella niente: si sceglie dove spostare i movimenti, poi sparisce
const catRow = name => `[...document.querySelectorAll('.cat-list .row')].find(r => r.querySelector('.row-main')?.textContent === '${name}')`
await step('Profilo → Budget: eliminare «Affitto» mostra chi la usa', async () => {
  await js(`document.querySelector('.kb-list') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await js(`location.hash = '#/profile/budget'`); await sleep(900)
  await click(catRow('Affitto')); await sleep(500)
  await click(byText('/Elimina categoria/', '.bs button'))
}, `/Movimenti: 1/.test(document.querySelector('.bs .cat-delete')?.innerText ?? '')`)
await step('«Sposta ed elimina» porta la spesa in «Spesa» e toglie la categoria', async () => {
  await setField('.cat-delete select', 'groceries'); await sleep(200)
  await click(byText('/Sposta ed elimina/', '.cat-delete button')); await sleep(600)
}, `!${catRow('Affitto')}`)
await step('la spesa da 12,50 € c\'è ancora, ora in «Spesa»', () => js(`location.hash = '#/analysis/transactions'`),
  `/12,50/.test(document.body.innerText) && /Spesa/.test([...document.querySelectorAll('li, .row')].find(r => /12,50/.test(r.textContent))?.textContent ?? '')`)

console.log('Tastiera')
const press = (key, code) => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key.length === 1 ? key : undefined, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) })
await step('G poi N apre le Notizie', async () => { await js(`document.activeElement?.blur()`); await press('g', 'KeyG'); await press('n', 'KeyN') }, `location.hash === '#/news'`)
await step('N apre il nuovo movimento', () => press('n', 'KeyN'), `!!document.querySelector('.tx-sheet')`)
await step('Esc lo chiude', () => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }), `!document.body.classList.contains('sheet-open')`)
await step('? mostra le scorciatoie', async () => { await sleep(600); await press('?', 'Slash') }, `!!document.querySelector('.kb-list')`)

console.log('Importazione conto personale e deposito')
const lines = ['Deposito senza vincoli (EUR),,,,,', 'Valore del deposito,,,,,', ',,Saldo di chiusura,"100,00€",,',
  'Conto personale (EUR),,,,,', 'Riepilogo della transazione,,,,,', 'Data,Descrizione,Categoria,Denaro in entrata/uscita,Saldo,Costi',
  '1 ott 2026,QA Spesa sintetica,Spesa,"-2,50€","100,00€",', '2 ott 2026,A EUR Conto deposito senza vincoli,Trasferimento,"-10,00€","90,00€",', 'Totale,,,,,']
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lines.map(x => [x])), 'Statement')
const fixture = join(fixtureDir, 'synthetic.xlsx'); writeFileSync(fixture, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
await step('il file Excel mostra solo movimenti e risparmi in anteprima', async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await js(`location.hash = '#/analysis/transactions'`); await sleep(800)
  const root = await cdp('DOM.getDocument'); const input = await cdp('DOM.querySelector', { nodeId: root.result.root.nodeId, selector: 'input[type=file]' })
  await cdp('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [fixture] })
}, `/Controlla l.importazione/.test(document.body.innerText) && /1 movimenti/.test(document.body.innerText) && /100,00/.test(document.body.innerText)`)
let savingsChoiceEnabled = false
await step('la conferma prepara il movimento senza importare il trasferimento', async () => {
  savingsChoiceEnabled = !(await js(`document.querySelector('[aria-label="Controlla l’importazione"] select')?.disabled`))
  const changed = savingsChoiceEnabled ? await setField('[aria-label="Controlla l’importazione"] select', 'new') : false
  await sleep(150)
  const selected = await js(`document.querySelector('[aria-label="Controlla l’importazione"] select')?.value`)
  await js(`window.__qaConfirmClick = 0; document.querySelector('[aria-label="Controlla l’importazione"] button')?.addEventListener('click', () => window.__qaConfirmClick++, { once: true })`)
  const clicked = await clickNative('[aria-label="Controlla l’importazione"] button')
  await sleep(250)
  console.log('  Esito sintetico:', JSON.stringify({ changed, selected, clicked, savingsChoiceEnabled, eventSeen: await js('window.__qaConfirmClick'), runtimeErrors: errors.length }))
}, `/QA Spesa sintetica/.test(document.body.innerText) && !/A EUR Conto deposito senza vincoli/.test(document.body.innerText)`)
await step('il capitale preesistente è conservato', () => js(`location.hash = '#/profile/capital'`), `/2[.]000,00/.test(document.body.innerText)`)
if (savingsChoiceEnabled) await step('il saldo del deposito entra solo nella destinazione confermata', null,
  `/Conto deposito/.test(document.body.innerText) && /100,00/.test(document.body.innerText) && /2[.]000,00/.test(document.body.innerText)`)

await checkHomeForecast()
if (process.env.E2E_UX_STOP_AFTER_VISUAL) {
  console.log(`\nUX browser path passed through ${n} steps.`)
  await done(0)
}

console.log('Importazione CSV annuale')
const annualRows = ['Savings Accounts Summaries,,,,', 'Instant Access Savings (EUR),,,,', 'Savings account details,,,,',
  ',,Closing balance,123.45,', 'Personal Account (EUR),,,,', 'Summary,,,,', 'Date,Description,Category,Money in/out,Balance',
  ...['Jan 02', 'Feb 03', 'Mar 04', 'Apr 05', 'May 06', 'Jun 07', 'Jul 08', 'Aug 09', 'Sep 10', 'Oct 11', 'Nov 12', 'Dec 31']
    .map((d, i) => `"${d}, 2026",QA-B-${i + 1},Other,${i === 0 ? '-2.35' : '1.00'},100.00`),
  '"Jan 06, 2026",QA-B-repeat,Other,-1.25,90.00', '"Jan 06, 2026",QA-B-repeat,Other,-1.25,88.75',
  'Total,,,,' ]
const annualCsv = join(fixtureDir, 'synthetic-year.csv'); writeFileSync(annualCsv, annualRows.join('\n'))
const selectCsv = async (file = annualCsv) => {
  const root = await cdp('DOM.getDocument'), input = await cdp('DOM.querySelector', { nodeId: root.result.root.nodeId, selector: 'input[type=file]' })
  if (!input.result.nodeId) throw Error('input CSV non trovato')
  await cdp('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [file] })
}
await step('il CSV annuale mostra tutte le date e conserva le righe ripetute', async () => {
  await js(`location.hash = '#/analysis/transactions'`); await sleep(500); await selectCsv()
}, `/Periodo trovato nel file/.test(document.body.innerText) && /2026/.test(document.body.innerText) && /righe hanno data/.test(document.body.innerText)`)
await step('la conferma inserisce tutte le date annuali nella casella globale', async () => {
  await clickNative('[aria-label="Controlla l’importazione"] button'); await sleep(300)
}, `/QA-B-12/.test(document.body.innerText) && /QA-B-repeat/.test(document.body.innerText) && /15/.test(document.querySelector('h3')?.innerText ?? '')`)
await step('un secondo caricamento dello stesso CSV non crea duplicati', async () => {
  await selectCsv(); await sleep(250); await clickNative('[aria-label="Controlla l’importazione"] button')
}, `/0 movimenti da confermare · 14 già importati/.test(document.body.innerText) && /15/.test(document.querySelector('h3')?.innerText ?? '')`)

console.log('Importazione CSV generica (Fase 2E)')
// «-1.234» e «-1,234» senza altri indizi: l'app chiede come sono scritti i numeri, poi esclude la riga incompatibile con il motivo
const ambiguousCsv = join(fixtureDir, 'synthetic-ambiguous.csv')
writeFileSync(ambiguousCsv, 'Data;Descrizione;Importo\n28/10/2026;QA Affitto 2E;-1.234\n29/10/2026;QA Caffè 2E;-1,234\n')
const inSheet = re => `${re}.test(document.querySelector('.bs')?.innerText ?? '')`
const chooseComma = async () => {
  await click(`document.querySelector('.bs [role=radio]')`); await sleep(200)
  await click(byText('/^Continua$/', '.bs button')); await sleep(400)
}
await step('un CSV ambiguo non si importa da solo: chiede come sono scritti i numeri, con l’esempio letto nei due modi', async () => {
  await js(`location.hash = '#/analysis/transactions'`); await sleep(500); await selectCsv(ambiguousCsv); await sleep(600)
}, inSheet(`/può voler dire due importi diversi/`) + ` && ` + inSheet(`/-1[.]234 → -1[.]234,00/`))
await step('con la virgola per i decimali: −1.234,00 € e la riga «-1,234» esclusa con il motivo', chooseComma,
  inSheet(`/Movimenti da importare[^0-9]*1[^0-9]/`) + ` && ` + inSheet(`/Riga 3 · più decimali di quelli della valuta/`))
await step('confermato, entra nella casella con l’importo esatto', async () => {
  await click(byText('/^Importa 1 movimento$/', '.bs button')); await sleep(600)
}, `/QA Affitto 2E/.test(document.body.innerText) && /1[.]234,00/.test(document.body.innerText) && !/QA Caffè 2E/.test(document.body.innerText)`)
await step('reimportare lo stesso file non crea doppioni', async () => {
  await selectCsv(ambiguousCsv); await sleep(600); await chooseComma()
}, inSheet(`/Già importati/`) + ` && !!document.querySelector('.bs .btn.primary')?.disabled`)
await click(byText('/^Annulla$/', '.bs button'))

// colonne sconosciute: si scelgono a mano (uscite ed entrate separate) e il telefono le ricorda per lo stesso tipo di file
const columnsCsv = join(fixtureDir, 'synthetic-columns.csv')
writeFileSync(columnsCsv, 'Quando;Cosa;Uscita;Entrata\n28/10/2026;QA Colonne Affitto;1.234,00;\n29/10/2026;QA Colonne Rimborso;;12,50\n')
const pickColumn = (i, col) => js(`(() => { const s = document.querySelectorAll('.bs select')[${i}]
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${col}'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
await step('un CSV con colonne sconosciute chiede quali usare', async () => {
  await selectCsv(columnsCsv); await sleep(600)
}, inSheet(`/Quali colonne usare/`))
await step('scelte data, descrizione, uscite ed entrate: il riepilogo legge segni e importi esatti', async () => {
  await pickColumn(0, 0); await pickColumn(1, 1); await pickColumn(3, 2); await pickColumn(4, 3); await sleep(200)
  await click(byText('/^Continua$/', '.bs button')); await sleep(400)
}, inSheet(`/Movimenti da importare[^0-9]*2[^0-9]/`) + ` && ` + inSheet(`/scelte a mano/`) + ` && ` + inSheet(`/1[.]234,00/`))
await step('confermati, entrano nella casella', async () => {
  await click(byText('/^Importa 2 movimenti$/', '.bs button')); await sleep(600)
}, `/QA Colonne Affitto/.test(document.body.innerText) && /QA Colonne Rimborso/.test(document.body.innerText)`)
await step('lo stesso tipo di file la volta dopo: colonne ricordate, nessun doppione', async () => {
  await selectCsv(columnsCsv); await sleep(600)
}, `!` + inSheet(`/Quali colonne usare/`) + ` && ` + inSheet(`/Già importati/`))
await click(byText('/^Annulla$/', '.bs button'))

// Excel generico con due fogli: si importa quello con le colonne riconosciute, date e numeri presi dalle celle
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Estratto sintetico QA'], ['nessun movimento qui']]), 'Info')
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Data', 'Descrizione', 'Importo'], [new Date(2026, 9, 27), 'QA Excel Spesa', -42.5]], { cellDates: true }), 'Movimenti')
const xlsxFile = join(fixtureDir, 'synthetic-two-sheets.xlsx'); writeFileSync(xlsxFile, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
await step('un Excel con due fogli: importa quello dei movimenti con l’importo della cella', async () => {
  await selectCsv(xlsxFile); await sleep(900)
}, inSheet(`/Movimenti da importare[^0-9]*1[^0-9]/`) + ` && ` + inSheet(`/42,50/`))
await step('confermato, entra nella casella', async () => {
  await click(byText('/^Importa 1 movimento$/', '.bs button')); await sleep(600)
}, `/QA Excel Spesa/.test(document.body.innerText)`)

// P2.3: una cella con formula ha un valore salvato che può essere vecchio: la riga si esclude con il motivo, non si importa
const formulaBook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(formulaBook, XLSX.utils.aoa_to_sheet([['Data', 'Descrizione', 'Importo'],
  [new Date(2026, 9, 27), 'QA Excel Formula', { t: 'n', f: 'C3*100', v: -999 }], [new Date(2026, 9, 27), 'QA Excel Numero', -7.25]], { cellDates: true }), 'Movimenti')
const formulaFile = join(fixtureDir, 'synthetic-formula.xlsx'); writeFileSync(formulaFile, XLSX.write(formulaBook, { type: 'buffer', bookType: 'xlsx' }))
await step('un Excel con una formula nell’importo: quella riga è esclusa con il motivo', async () => {
  await selectCsv(formulaFile); await sleep(900)
}, inSheet(`/Movimenti da importare[^0-9]*1[^0-9]/`) + ` && ` + inSheet(`/Riga 2 · valore calcolato da una formula/`) + ` && !` + inSheet(`/999/`))
await click(byText('/^Annulla$/', '.bs button')); await sleep(300)

// P2.2: un CSV oltre i limiti non si legge: messaggio chiaro e nessun cambiamento nella casella
const bigCsv = join(fixtureDir, 'synthetic-too-large.csv')
writeFileSync(bigCsv, 'Data;Descrizione;Importo\n' + '28/10/2026;QA Grande;-1,00\n'.repeat(Math.ceil(5 * 1024 * 1024 / 28)))
const inboxBefore = await js(`document.querySelector('.card-inbox h3')?.innerText ?? ''`)
await step('un CSV troppo grande è rifiutato prima di leggerlo, e la casella non cambia', async () => {
  await selectCsv(bigCsv); await sleep(600)
}, `/File troppo grande/.test(document.body.innerText) && !document.querySelector('.bs') && (document.querySelector('.card-inbox h3')?.innerText ?? '') === ${JSON.stringify(inboxBefore)}`)
async function checkHomeForecast() {
console.log('Home → Adesso: previsione negativa e leggibilità mobile')
await step('creo un fixture sintetico che porta la previsione sotto zero', async () => {
  await js(`location.hash = '#/'`); await sleep(500)
  await click(`document.querySelector('.tab-add')`); await sleep(500)
  await type('2500,00'); await sleep(150)
  await click(`document.querySelector('.cat-pick button')`)
  await click(`document.querySelector('.tx-sheet button[type=submit]')`); await sleep(600)
  await js(`location.hash = '#/'`); await sleep(500)
  await js(`if (!document.querySelector('.now')?.innerText.includes('Previsione:')) document.querySelector('.now-toggle')?.click()`)
}, `/Previsione:/.test(document.querySelector('.now')?.innerText ?? '') && /spese variabili/.test(document.querySelector('.now')?.innerText ?? '')`)

const initialTheme = await js(`document.documentElement.dataset.theme`)
const forecastLayout = async () => js(`(() => {
  const title = [...document.querySelectorAll('.now-main > span')].find(x => x.textContent.includes('Previsione:'))
  const detail = title?.parentElement.querySelector('small')
  if (!title || !detail) return null
  const row = title.closest('.now-row')
  const rowsFit = [...document.querySelectorAll('.now-row')].every(item => {
    const box = item.getBoundingClientRect(), main = item.querySelector('.now-main'), end = item.querySelector('.now-end')
    if (!main || main.getBoundingClientRect().left < box.left - 1 || main.getBoundingClientRect().right > box.right + 1) return false
    const textsFit = [...main.children].every(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)
    return textsFit && (!end || (end.scrollWidth <= end.clientWidth + 1 && main.getBoundingClientRect().right <= end.getBoundingClientRect().left + 1))
  })
  return { title: title.textContent, detail: detail.textContent,
    titleFits: title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1,
    detailFits: detail.scrollWidth <= detail.clientWidth + 1 && detail.scrollHeight <= detail.clientHeight + 1,
    wraps: title.clientHeight > parseFloat(getComputedStyle(title).lineHeight),
    noEllipsis: getComputedStyle(title).whiteSpace !== 'nowrap' && getComputedStyle(title).textOverflow !== 'ellipsis',
    rowContains: row.scrollHeight <= row.clientHeight + 1, rowsFit }
})()`)
for (const theme of ['light', 'dark']) for (const [width, height] of [[320, 568], [375, 667], [390, 844], [412, 915], [820, 1180], [1440, 900]]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
  await js(`document.documentElement.dataset.theme = '${theme}'`)
  await sleep(50)
  const layout = await forecastLayout()
  if (!layout?.titleFits || !layout?.detailFits || !layout?.rowContains || !layout?.rowsFit || !layout?.noEllipsis || (width === 320 && !layout.wraps))
    throw Error(`Now forecast clipped at ${width}x${height} (${theme}): ${JSON.stringify(layout)}`)
  console.log(`  ✓ ${width}×${height} ${theme}: titolo e descrizione completi${layout.wraps ? ', testo a capo' : ''}`)
  if (screenshotDir) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(screenshotDir, `now-${theme}-${width}x${height}.png`), Buffer.from(shot.result.data, 'base64'))
  }
}
await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true })
await js(`document.documentElement.dataset.theme = 'light'`)
await js(`document.documentElement.style.setProperty('--t-h2', '40px'); document.documentElement.style.setProperty('--t-body', '32px'); document.documentElement.style.setProperty('--t-sm', '26px'); document.documentElement.style.setProperty('--t-cap', '22px')`)
await sleep(50)
const enlarged = await forecastLayout()
if (!enlarged?.titleFits || !enlarged?.detailFits || !enlarged?.rowContains || !enlarged?.rowsFit) throw Error(`Now forecast clipped with 200% text: ${JSON.stringify(enlarged)}`)
console.log('  ✓ 320×568 con caratteri portati al 200%: contenuto completo e senza clipping')
if (screenshotDir) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(screenshotDir, 'now-light-320x568-text-200.png'), Buffer.from(shot.result.data, 'base64'))
}
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await js(`document.documentElement.dataset.theme = '${initialTheme ?? 'light'}'; for (const key of ['--t-h2', '--t-body', '--t-sm', '--t-cap']) document.documentElement.style.removeProperty(key)`)
}

if (errors.length) { console.error(`\nErrori nella pagina:\n  ${errors.join('\n  ')}`); await done(1) }
console.log(`\nTutti i ${n} passi sono andati bene.`)
await done(0)
