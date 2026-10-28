// Prove dell'Alpha in locale: l'app costruita in modalità alpha contro un finto backend (tests/fake-alpha.mjs) che imita
// Supabase Auth, il gateway /api/rest/* e CAS v2. Due Chrome separati sono due dispositivi dello stesso account
// (IndexedDB, service worker e sessione distinti), un terzo è l'account B.
// Copre: accesso, errori, sessione, invito, cambio account; sincronizzazione tra dispositivi, copia vecchia,
// conflitto e risoluzione, offline con chiusura e riapertura, 429, 413, risposta persa; service worker e aggiornamento.
// NON sostituisce il collaudo sul cloud vero: il backend è simulato (vedi docs/CLOSED-ALPHA.md).
// Uso: npm run e2e:alpha
import { spawnSync } from 'node:child_process'
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openChrome, sleep } from '../tools/chrome.mjs'
import { startFakeAlpha, USERS } from './fake-alpha.mjs'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const PORT = 4192, ORIGIN = `http://127.0.0.1:${PORT}`, OUT = join(root, 'dist-alpha-e2e'), OUT2 = join(root, 'dist-alpha-e2e-v2')

// 1. l'app Alpha costruita per il backend locale (stessi controlli di tools/alpha/build.mjs: solo localhost)
if (!process.env.E2E_NO_BUILD) {
  const env = { ...process.env, BASE_PATH: '/', VITE_SUPABASE_URL: ORIGIN, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_local',
    VITE_SUPABASE_ANON_KEY: '', VITE_FLAGS: '', VITE_VAPID_PUBLIC_KEY: '' }
  const run = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'alpha', '--outDir', OUT, '--logLevel', 'error'], { cwd: root, env, stdio: 'inherit' })
  if (run.status !== 0) process.exit(run.status ?? 1)
}
// il simulatore resta fuori dall'app costruita: niente comandi /__e2e, niente codice del finto backend, niente utenti di prova
const leaks = readdirSync(OUT, { recursive: true }).map(String).filter(f => /\.(js|html|json|webmanifest|map)$/.test(f))
  .filter(f => /__e2e|fake-alpha|x-e2e-token|startFakeAlpha|Prova-[AB]-2026/.test(readFileSync(join(OUT, f), 'utf8')))
if (leaks.length) { console.error(`Il simulatore è finito nella build: ${leaks.join(', ')}`); process.exit(1) }
console.log('Build controllata: il simulatore non è incluso.')
// una seconda "versione" per provare l'aggiornamento del service worker: stessa app, index e precache diversi
rmSync(OUT2, { recursive: true, force: true }); cpSync(OUT, OUT2, { recursive: true })
writeFileSync(join(OUT2, 'app/index.html'), readFileSync(join(OUT2, 'app/index.html'), 'utf8').replace('<head>', '<head><meta name="e2e-build" content="2">'))
writeFileSync(join(OUT2, 'sw-account-v2.js'), readFileSync(join(OUT2, 'sw-account-v2.js'), 'utf8').replace(/(url:"app\/index\.html",revision:")[a-f0-9]+/, '$1e2e0000000000000000000000000002'))

const server = await startFakeAlpha({ port: PORT, fixtures: { v1: OUT, v2: OUT2 } })
const api = async (path, body) => {
  const headers = { 'x-e2e-token': server.controlToken }
  try { return await (await fetch(`${ORIGIN}/__e2e/${path}`, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers })).json() }
  catch (e) { throw Error(`controllo del finto server (${path}): ${e.cause?.message ?? e.message}`) }
}
const remote = user => api(`state?user=${user}`)
const devices = []
let n = 0, failed = false
const done = async code => { for (const d of devices) await d.close().catch(() => {}); await server.close(); rmSync(OUT2, { recursive: true, force: true }); process.exit(code) }

async function device(name, port) {
  const errors = []
  const c = await openChrome({ port, args: ['--lang=it-IT'], waitMs: 45_000, onError: e => errors.push(e) })
  devices.push(c)
  await c.cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 919, deviceScaleFactor: 1, mobile: true })
  await c.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await c.cdp('Network.enable')
  const d = {
    name, errors, ...c,
    type: async text => { for (const ch of text) await c.cdp('Input.insertText', { text: ch }) },
    click: sel => c.js(`(() => { const el = ${sel}; el?.click(); return !!el })()`),
    text: () => c.js(`document.body.innerText`),
    offline: on => c.cdp('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }),
    open: async (path = '/app/') => { await c.cdp('Page.navigate', { url: ORIGIN + path }); await sleep(1500) },
    reload: async () => { await c.cdp('Page.reload'); await sleep(1800) },
  }
  await d.open(); await c.js(`localStorage.setItem('quadriamo.lang', 'it')`); await d.reload()
  return d
}
const byText = (re, scope = 'button') => `[...document.querySelectorAll('${scope}')].find(b => ${re}.test(b.textContent.trim()))`
const has = re => `${re}.test(document.body.innerText)`
/** Un passo: azione, poi una condizione che deve diventare vera (nella pagina, o sul server se è una funzione). */
async function step(d, name, action, check, seconds = 8) {
  n++
  try {
    if (action) await action()
    for (let i = 0; i < seconds * 5; i++) {
      if (typeof check === 'function' ? await check() : await d.js(check)) {
        console.log(`  ✓ ${n}. ${d.name}: ${name}`)
        if (process.env.E2E_VERBOSE) console.log(`      ${(await d.text()).replace(/\s+/g, ' ').slice(0, 300)}`)
        return
      }
      await sleep(200)
    }
    throw Error(`condizione non vera: ${check}`)
  } catch (e) {
    // P1: distingue «nessun movimento» da «righe presenti ma non ancora disegnate» (content-visibility: auto fuori dal testo letto)
    const rows = await d.js(`JSON.stringify({ righe: document.querySelectorAll('.tx-list > li').length, visibile: document.visibilityState })`).catch(() => '')
    console.error(`  ✗ ${n}. ${d.name}: ${name}\n    ${e.message}\n    pagina: ${(await d.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 1200)}\n    movimenti nel DOM: ${rows}`)
    failed = true; await done(1)
  }
}
async function signIn(d, who, password = USERS[who].password) {
  if (await d.js(`!!document.querySelector('.gate-cta')`)) { await d.click(`document.querySelector('.gate-cta')`); await sleep(700) }
  if (await d.js(`!!document.querySelector('.inst-skip')`)) { await d.click(`document.querySelector('.inst-skip')`); await sleep(700) }
  await d.js(`document.querySelector('input[type=email]')?.focus()`); await d.type(USERS[who].email)
  await d.click(`document.querySelector('form .btn.primary')`); await sleep(600)
  await d.js(`document.querySelector('input[type=password]')?.focus()`); await d.type(password)
  await d.click(`document.querySelector('form .btn.primary')`)
}
const appReady = `!!document.querySelector('.tabbar')`
async function signOut(d) {
  await d.js(`location.hash = '#/profile/security'`); await sleep(900)
  const clicked = await d.click(`[...document.querySelectorAll('button, a, [role=button]')].find(b => /^Esci(?! dagli)/.test(b.textContent.trim()))`)
  if (!clicked || !await until(d, `!!document.querySelector('.gate.gate-welcome')`, 10000)) throw Error('logout sintetico non completato')
}
async function finishSetup(d) {
  await d.click(`document.querySelector('.onboarding .btn.primary')`); await sleep(700)
  await d.click(`document.querySelector('.persona-row')`); await sleep(500)
  for (let i = 0; i < 14 && !(await d.js(appReady)); i++) { await d.click(`document.querySelector('.step-nav .btn.primary')`); await sleep(450) }
}
/** Aspetta che una condizione nella pagina diventi vera (al massimo `ms`). */
async function until(d, expr, ms = 8000) { for (let i = 0; i < ms / 100; i++) { if (await d.js(expr)) return true; await sleep(100) } return false }
/** Una spesa come la segna una persona: foglio aperto, importo scritto e controllato, categoria, Salva, foglio chiuso. */
async function addExpense(d, amount) {
  await d.click(`document.querySelector('.tab-add')`)
  if (!await until(d, `!!document.querySelector('.tx-sheet .amount-input')`)) throw Error(`foglio del nuovo movimento non aperto (${amount})`)
  await d.js(`document.querySelector('.tx-sheet .amount-input').focus()`); await d.type(amount)
  if (!await until(d, `document.querySelector('.tx-sheet .amount-input')?.value === ${JSON.stringify(amount)}`, 3000)) throw Error(`importo non scritto (${amount})`)
  await d.click(`document.querySelector('.cat-pick button')`)
  await d.click(`document.querySelector('.tx-sheet button[type=submit]')`)
  if (!await until(d, `!document.querySelector('.tx-sheet')`)) throw Error(`spesa non salvata: il foglio è rimasto aperto (${amount})`)
}
/** Due fotogrammi entro 1,5 s: senza, le righe con content-visibility: auto restano fuori da innerText (P1, non un elenco vuoto). */
const rendered = d => d.js(`new Promise(r => { const t = setTimeout(() => r(false), 1500); requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(true) })) })`)
const toList = async d => {
  await d.js(`location.hash = '#/analysis/transactions'`); await until(d, `!!document.querySelector('.tabbar') && location.hash === '#/analysis/transactions'`); await sleep(500)
  if (!await rendered(d)) { await d.cdp('Page.bringToFront'); if (!await rendered(d)) throw Error('la pagina non disegna fotogrammi: il testo delle righe non è leggibile (P1)') }
}
const amounts = doc => (doc?.transactions ?? []).map(t => t.amount).sort((a, b) => a - b)

console.log('Accesso')
const A1 = await device('telefono A', 9461)
await step(A1, 'l\'Alpha dice che è solo su invito', async () => {
  await A1.click(`document.querySelector('.gate-cta')`); await sleep(700); await A1.click(`document.querySelector('.inst-skip')`)
}, has('/riservata agli invitati/'))
await step(A1, 'password sbagliata: messaggio chiaro, si può riprovare', () => signIn(A1, 'A', 'sbagliata-123'), has('/Email o password non corretti/'))
await step(A1, 'password giusta: account nuovo, si configura il budget', async () => {
  await A1.click(byText('/Indietro/')); await sleep(400); await A1.js(`document.querySelector('input[type=email]').value = ''`)
  await A1.reload(); await signIn(A1, 'A')
}, `!!document.querySelector('.onboarding')`)
await step(A1, 'configurazione completata, il budget arriva sul cloud', () => finishSetup(A1), async () => (await A1.js(appReady)) && (await remote('A')).revision >= 1, 15)
await step(A1, 'una spesa di 12,50 € arriva sul cloud', () => addExpense(A1, '12,50'), async () => amounts((await remote('A')).document).includes(12.5), 10)
await step(A1, 'dopo aver ricaricato la pagina la sessione resta e i dati ci sono', () => A1.reload(), `${appReady} && /12,50/.test(document.body.innerText)`)

console.log('Funzioni non disponibili nell\'Alpha')
await step(A1, 'quando va tutto bene nessun pannello tecnico in cima, nessuna richiesta di statistiche', async () => { await A1.js(`location.hash = '#/'`); await sleep(2500) },
  `${appReady} && !document.querySelector('[data-testid=cloud-status]') && !/Aiutaci a migliorare la beta/.test(document.body.innerText)`)
await step(A1, 'il pannello della sincronizzazione è in Profilo → Esporta e importa', () => A1.js(`location.hash = '#/profile/data'`),
  `/revisione cloud \\d+/.test(document.querySelector('[data-testid=cloud-status]')?.innerText ?? '')`)
await step(A1, 'il Profilo non mostra Budget comune, statistiche d\'uso e invito', () => A1.js(`location.hash = '#/profile'`),
  `/Esporta e importa/.test(document.body.innerText) && !/Budget comune|Statistiche d’uso anonime|Invita un amico/.test(document.body.innerText)`)
await step(A1, 'il Budget comune aperto da un vecchio link dice che non è ancora disponibile', () => A1.js(`location.hash = '#/profile/shared'`),
  `/Non ancora disponibile in questa Alpha/.test(document.body.innerText) && !/Scopri Pro/.test(document.body.innerText)`)
await step(A1, 'Notizie: spiega che non sono attive e mostra i consigli', () => A1.js(`location.hash = '#/news'`),
  `/non sono ancora attive/.test(document.body.innerText) && /Consigli di Quadriamo/.test(document.body.innerText) && !/Serve la connessione/.test(document.body.innerText)`)
await step(A1, 'Segnala un problema: a chi scrivere, cosa non mandare, dettagli tecnici senza dati personali', () => A1.js(`location.hash = '#/profile/feedback'`),
  `/chi ti ha invitato/.test(document.body.innerText) && /Non mandare mai password/.test(document.body.innerText)
   && /revisione/.test(document.querySelector('.alpha-details')?.innerText ?? '') && !/[\\w.-]+@[\\w-]+\\.[a-z]|12,50|12\\.5/.test(document.querySelector('.alpha-details')?.innerText ?? '')`)
await A1.js(`location.hash = '#/'`)

console.log('Due dispositivi dello stesso account')
const A2 = await device('PC A', 9462)
await step(A2, 'accedendo, il PC scarica il budget invece di proporne uno nuovo', () => signIn(A2, 'A'), `${appReady} && /12,50/.test(document.body.innerText)`, 15)
await step(A2, 'modifiche offline su entrambi, poi online: si uniscono senza conflitto', async () => {
  await A1.offline(true); await A2.offline(true)
  await addExpense(A1, '7'); await addExpense(A2, '3'); await sleep(500)
  await A1.offline(false); await sleep(2500); await A2.offline(false)
}, async () => JSON.stringify(amounts((await remote('A')).document)) === JSON.stringify([3, 7, 12.5]), 15)
await step(A1, 'il telefono riceve la spesa del PC', async () => { await A1.reload(); await toList(A1) },
  `/3,00/.test(document.body.innerText) && !document.querySelector('.cloud-conflict')`, 12)

console.log('Copia vecchia sul PC (scenario del 21/10)')
await A2.offline(true)
await step(A1, 'il telefono aggiunge l\'abbonamento Netflix', async () => {
  await A1.js(`location.hash = '#/profile/recurring'`); await sleep(800)
  await A1.click(byText('/Aggiungi abbonamento/')); await sleep(700)
  await A1.js(`(() => { const el = document.querySelector('.sp input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'net'); el.dispatchEvent(new Event('input', { bubbles: true })) })()`); await sleep(400)
  await A1.click(`document.querySelector('.sp-list .row')`); await sleep(900)
  await A1.js(`document.querySelector('.event-form input[inputmode=decimal]').focus()`); await A1.type('12,99')
  await A1.click(byText('/Aggiungi al calendario/', '.event-form button'))
}, async () => ((await remote('A')).document?.settings.events ?? []).some(e => /Netflix/.test(e.title)), 12)
await step(A2, 'il PC con la copia vecchia cambia un\'impostazione offline e torna online: Netflix resta ovunque', async () => {
  await A2.js(`location.hash = '#/profile/budget'`); await sleep(900)
  await A2.js(`[...document.querySelectorAll('.cat-list .row')].find(r => r.querySelector('.row-main')?.textContent === 'Svago e shopping').click()`); await sleep(600)
  await A2.js(`(() => { const el = document.querySelector('.bs .cat-sheet input'); el.focus(); el.select() })()`)
  await A2.type('Svago'); await sleep(600)
  await A2.offline(false)
}, async () => { const d = (await remote('A')).document; return d?.settings.events.some(e => /Netflix/.test(e.title)) && d.settings.categories.some(c => c.name === 'Svago') }, 15)
await step(A2, 'e il PC ora mostra Netflix', async () => { await A2.js(`location.hash = '#/profile/recurring'`); await sleep(900) }, has('/Netflix/'), 10)

console.log('Conflitto vero e risoluzione')
await step(A2, 'stesso importo cambiato offline sui due dispositivi: il PC chiede solo quel campo', async () => {
  await A1.offline(true); await A2.offline(true)
  for (const [d, value] of [[A1, '13,99'], [A2, '14,99']]) {
    await d.js(`location.hash = '#/profile/recurring'`); await sleep(800)
    await d.click(`[...document.querySelectorAll('.subs-list .row')].find(r => /Netflix/.test(r.textContent))`); await sleep(900)
    await d.js(`(() => { const el = document.querySelector('.event-form input[inputmode=decimal]'); el.focus(); el.select() })()`); await d.type(value)
    await d.click(byText('/^Salva$/', '.event-form button')); await sleep(500)
  }
  await A1.offline(false); await sleep(3000); await A2.offline(false)
}, `!!document.querySelector('.cloud-conflict') && /Scadenze/.test(document.querySelector('.cloud-conflict')?.innerText ?? '')`, 15)
await step(A2, 'scelgo la versione di questo dispositivo: il cloud ha 14,99 e niente si perde', async () => {
  await A2.click(`document.querySelector('.cloud-conflict input[type=radio][value=local]')`); await sleep(300)
  await A2.click(`document.querySelector('.cloud-conflict .btn.primary')`)
}, async () => { const d = (await remote('A')).document; return d?.settings.events.find(e => /Netflix/.test(e.title))?.amount === 14.99 && amounts(d).length === 3 }, 15)

console.log('Offline, chiusura e riapertura')
await step(A1, 'spesa offline, app chiusa e riaperta offline: la spesa c\'è ancora', async () => {
  await A1.offline(true); await A1.js(`location.hash = '#/'`); await sleep(500); await addExpense(A1, '4,20'); await sleep(600)
  await A1.reload(); await toList(A1)
}, `/4,20/.test(document.body.innerText)`, 12)
await step(A1, 'tornata la rete, arriva sul cloud una volta sola', async () => { await A1.offline(false) },
  async () => amounts((await remote('A')).document).filter(x => x === 4.2).length === 1, 15)

console.log('Errori del server')
await step(A1, '429: l\'app aspetta il tempo indicato, tiene la modifica, poi sincronizza', async () => {
  await api('fault', { route: 'rpc/qsync_write_v2', kind: 'rate', retryAfter: 3 })
  await addExpense(A1, '5,10')
}, async () => amounts((await remote('A')).document).includes(5.1), 20)
await step(A1, '413: documento troppo grande, messaggio chiaro e dati conservati sul telefono', async () => {
  await api('fault', { route: 'rpc/qsync_write_v2', kind: 'tooLarge', persistent: true })
  await addExpense(A1, '6,30')
  await A1.js(`location.hash = '#/profile/sync'`)
}, async () => {
  const s = await remote('A'), body = await A1.text()
  return s.write413.filter(x => x.httpStatus === 413).length >= 1
    && !amounts(s.document).includes(6.3)
    && /supera il limite del server/.test(body) && /restano salvate qui/.test(body)
}, 15)
await step(A1, 'il 413 persistente resta visibile dopo una richiesta manuale aggiuntiva', async () => {
  await A1.click(byText('/Riprova la sincronizzazione/'))
}, async () => {
  const s = await remote('A'), body = await A1.text()
  return s.write413.filter(x => x.httpStatus === 413).length >= 2
    && !amounts(s.document).includes(6.3)
    && /supera il limite del server/.test(body) && /restano salvate qui/.test(body)
}, 10)
await step(A1, 'dopo la correzione del 413 persistente la stessa spesa arriva una volta', async () => {
  await api('clear-fault', { route: 'rpc/qsync_write_v2' })
  await A1.click(byText('/Riprova la sincronizzazione/'))
}, async () => amounts((await remote('A')).document).filter(x => x === 6.3).length === 1, 15)
let transient413Start = 0
await step(A1, 'rifiuto 413 una tantum registrato, senza scrittura cloud e con avviso persistente', async () => {
  transient413Start = (await remote('A')).write413.length
  await api('fault', { route: 'rpc/qsync_write_v2', kind: 'tooLarge' })
  await A1.js(`location.hash = '#/'`)
  await addExpense(A1, '6,31')
}, async () => {
  const s = await remote('A'), body = await A1.text()
  return s.write413.length === transient413Start + 1
    && !amounts(s.document).includes(6.31)
    && /supera il limite del server/.test(body) && /restano salvate qui/.test(body)
}, 10)
await step(A1, 'retry dopo il 413 una tantum: cloud aggiornato una volta e avviso rimosso', async () => {
  await A1.click(byText('/Riprova la sincronizzazione/'))
}, async () => {
  const s = await remote('A'), body = await A1.text()
  return s.write413.length === transient413Start + 1
    && amounts(s.document).filter(x => x === 6.31).length === 1
    && !/supera il limite del server/.test(body)
}, 15)
await step(A1, 'risposta persa dopo il salvataggio: stessa operazione ripetuta, una revisione sola', async () => {
  await api('fault', { route: 'rpc/qsync_write_v2', kind: 'drop' }); await A1.js(`location.hash = '#/'`); await sleep(400); await addExpense(A1, '8,40')
}, async () => { const s = await remote('A'); return amounts(s.document).filter(x => x === 8.4).length === 1 && s.log.filter(l => l.status === 'applied').length === s.revision }, 20)

console.log('Cambio di account sullo stesso dispositivo')
await step(A2, 'esco dall\'account A: torna l\'accesso, nessun dato visibile', async () => {
  await signOut(A2)
}, `(!!document.querySelector('input[type=email]') || !!document.querySelector('.gate-cta')) && !/La sessione è terminata/.test(document.body.innerText)`, 10)
await step(A2, 'entro come B: budget nuovo, niente dati di A', async () => { await signIn(A2, 'B') },
  `!!document.querySelector('.onboarding') && !/12,50|Netflix/.test(document.body.innerText)`, 12)
await step(A2, 'B configura il suo budget e lo sincronizza', () => finishSetup(A2), async () => (await A2.js(appReady)) && (await remote('B')).revision >= 1, 15)
await step(A2, 'il cloud di B non contiene i dati di A', null, async () => { const b = (await remote('B')).document; return amounts(b).length === 0 && !b.settings.events.some(e => /Netflix/.test(e.title)) })
await step(A2, 'esco da B e rientro come A: tornano i dati di A, nessuno di B', async () => {
  await A1.offline(true) // evita che il secondo dispositivo consumi la lettura ritardata del server finto
  await signOut(A2)
  if (!await until(A2, `!!document.querySelector('.gate.gate-welcome')`, 10000)) throw Error('logout da B non completato')
  const readsBefore = server.state.reads.filter(x => x.user === USERS.A.id).length
  await api('fault', { route: 'rpc/qsync_read', kind: 'delay', ms: 2000 })
  await signIn(A2, 'A')
  const deadline = Date.now() + 5000
  while (server.state.reads.filter(x => x.user === USERS.A.id).length <= readsBefore && Date.now() < deadline) await sleep(50)
  if (server.state.reads.filter(x => x.user === USERS.A.id).length <= readsBefore) throw Error('lettura cloud ritardata non avviata')
  await toList(A2)
  const intermediate = await A2.text()
  if (!await A2.js(appReady) || !/12,50/.test(intermediate) || /Prova-B|B-only/.test(intermediate))
    throw Error('copia locale di A non visibile o dati di B visibili mentre il cloud è lento')
  if (!await until(A2, appReady, 10000)) throw Error('ritorno da A non ha completato il caricamento dopo la risposta cloud')
  await toList(A2)
  await A1.offline(false)
}, `${appReady} && /12,50/.test(document.body.innerText)`, 15)

console.log('Sessione scaduta e rete assente')
const ended = `(!!document.querySelector('input[type=email]') || !!document.querySelector('.gate-cta')) && /La sessione è terminata/.test(document.body.innerText)`
await step(A1, 'la sessione finisce con l\'app aperta: l\'avviso compare subito e la spesa appena fatta resta', async () => {
  await A1.offline(true); await A1.js(`location.hash = '#/'`); await sleep(500); await addExpense(A1, '1,11'); await sleep(600)
  // come quando Supabase chiude la sessione (rinnovo rifiutato) o un'altra scheda esce: la sessione salvata diventa vuota
  await A1.js(`(() => { const k = Object.keys(localStorage).find(x => x.startsWith('q.auth.v1/'))
    localStorage.setItem(k, JSON.stringify({ format: 1, generation: 'e2e-ended', session: null })); window.dispatchEvent(new StorageEvent('storage', { key: k })) })()`)
}, ended, 12)
await step(A1, 'riaprendo l\'app l\'avviso è ancora lì', async () => { await A1.offline(false); await A1.reload() }, ended, 12)
let rejectedRefreshesBefore = 0
let refreshAttemptsBefore = 0
let accessExpiresAt = 0
await step(A1, 'revoca reale con app aperta: il rinnovo rifiutato mostra l\'avviso senza chiudere la pagina', async () => {
  // Un JWT breve permette di osservare il rinnovo fallito entro il timeout E2E;
  // la revoca avviene dopo un login nuovo mentre la pagina resta aperta.
  await A1.cdp('Page.bringToFront')
  if (await A1.js(`document.visibilityState`) !== 'visible') throw Error('Chrome non mantiene visibile il contesto di test')
  await api('tokens', { seconds: 15 }); await A1.reload()
  if (await A1.js(`!!document.querySelector('.tabbar')`)) {
    await signOut(A1)
    if (!await until(A1, `!!document.querySelector('input[type=email]') || !!document.querySelector('.gate-cta')`, 10000)) throw Error('logout sintetico non completato')
  }
  await signIn(A1, 'A')
  let ready = false
  for (let i = 0; i < 50; i++) { if (await A1.js(appReady)) { ready = true; break }; await sleep(200) }
  if (!ready) throw Error('nuovo login sintetico non completato')
  const session = await A1.js(`(() => { const k = Object.keys(localStorage).find(x => x.startsWith('q.auth.v1/')); const record = k && JSON.parse(localStorage.getItem(k)); const v = record?.session ? JSON.parse(record.session) : null; return { owner: v?.user?.id === ${JSON.stringify(USERS.A.id)}, remaining: v?.expires_at ? v.expires_at - Math.floor(Date.now()/1000) : null, expiresAt: v?.expires_at ? v.expires_at * 1000 : null } })()`)
  if (!session.owner || typeof session.remaining !== 'number' || session.remaining < 1 || session.remaining > 15) throw Error('sessione sintetica nuova non verificata')
  accessExpiresAt = session.expiresAt
  rejectedRefreshesBefore = server.state.rejectedRefreshes
  refreshAttemptsBefore = server.state.refreshAttemptsByUser.get(USERS.A.id) ?? 0
  await api('revoke', { user: 'A' })
  if ([...server.state.refresh.values()].includes(USERS.A.id)) throw Error('refresh sintetico non revocato')
}, async () => server.state.rejectedRefreshes > rejectedRefreshesBefore
  && server.state.lastRejectedRefreshAt >= accessExpiresAt && await A1.js(ended)
  && (server.state.refreshAttemptsByUser.get(USERS.A.id) ?? 0) - refreshAttemptsBefore <= 5, 150)
let closedRefreshAttemptsBefore = 0
let closedRejectedRefreshesBefore = 0
let closedReopenedAt = 0
await step(A2, 'sessione finita ad app chiusa (rinnovo revocato): l\'avviso compare alla riapertura', async () => {
  // Profilo separato dal test di revoca con app aperta: evita che il suo stato Auth influenzi questo caso.
  closedRefreshAttemptsBefore = server.state.refreshAttemptsByUser.get(USERS.A.id) ?? 0
  closedRejectedRefreshesBefore = server.state.rejectedRefreshes
  await api('tokens', { seconds: 3600 }); await signOut(A2)
  if (!await until(A2, `!!document.querySelector('.gate.gate-welcome')`, 10000)) throw Error('logout sintetico non completato')
  await signIn(A2, 'A')
  if (!await until(A2, appReady, 10000)) throw Error('login sintetico non completato prima della chiusura')
  const session = await A2.js(`(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('q.auth.v1/'))
    const record = k && JSON.parse(localStorage.getItem(k)), v = record?.session ? JSON.parse(record.session) : null
    if (!v || v.user?.id !== ${JSON.stringify(USERS.A.id)} || !v.refresh_token) return null
    const expiresAt = Math.floor(Date.now() / 1000) + 2
    v.expires_at = expiresAt; v.expires_in = 2; record.session = JSON.stringify(v)
    localStorage.setItem(k, JSON.stringify(record))
    return { expiresAt }
  })()`)
  if (!session || typeof session.expiresAt !== 'number') throw Error('sessione sintetica non valida')
  // Simula la prossima scadenza solo nei metadati locali, poi chiude prima di avviare il rinnovo.
  await A2.cdp('Page.navigate', { url: 'about:blank' })
  await api('revoke', { user: 'A' })
  if ([...server.state.refresh.values()].includes(USERS.A.id) || ![...server.state.revokedRefresh.values()].includes(USERS.A.id)) throw Error('refresh sintetico non revocato a pagina chiusa')
  while (Date.now() <= session.expiresAt * 1000 + 100) await sleep(50)
  closedReopenedAt = Date.now()
  await A2.open()
  await A2.cdp('Page.bringToFront')
  if (await A2.js(`document.visibilityState`) !== 'visible') throw Error('Chrome non mantiene visibile il contesto riaperto')
}, async () => {
  const endedNow = await A2.js(ended)
  const rejected = server.state.rejectedRefreshes - closedRejectedRefreshesBefore
  const attempts = (server.state.refreshAttemptsByUser.get(USERS.A.id) ?? 0) - closedRefreshAttemptsBefore
  if (endedNow && Date.now() > closedReopenedAt + 10000 && rejected === 0)
    throw Error(`session ended senza richiesta refresh rifiutata; attempts=${attempts}, revoked=${server.state.revokedRefresh.size}`)
  return endedNow && rejected > 0 && server.state.lastRejectedRefreshAt >= closedReopenedAt && attempts <= 5
}, 30)
await api('tokens', { seconds: 3600 })
await step(A1, 'server irraggiungibile durante l\'accesso: messaggio comprensibile', async () => {
  await api('down', { down: true }); await signIn(A1, 'A')
}, has('/Non riesco a raggiungere il server/'), 15)
await api('down', { down: false })
await step(A1, 'tornato il server, l\'accesso riesce e i dati ci sono, senza più l\'avviso', async () => { await A1.reload(); await signIn(A1, 'A'); await sleep(2500); await toList(A1) },
  `${appReady} && /12,50/.test(document.body.innerText) && !/La sessione è terminata/.test(document.body.innerText)`, 15)
await step(A1, 'la spesa fatta mentre la sessione scadeva arriva sul cloud dopo il nuovo accesso', null,
  async () => amounts((await remote('A')).document).includes(1.11), 15)

console.log('Invito')
const N = await device('invitato', 9463)
await step(N, 'il link d\'invito chiede di scegliere una password', async () => {
  const s = await api('invite', { user: 'N' })
  await N.cdp('Page.navigate', { url: 'about:blank' }); await sleep(300)                        // il link dell'email apre una pagina nuova
  await N.open(`/app/#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&type=invite`)
}, `!!document.querySelector('input[type=password]')`, 12)
await step(N, 'scelta la password, si configura il budget', async () => {
  await N.js(`document.querySelector('input[type=password]').focus()`); await N.type('Nuova-Password-2026')
  await N.click(`document.querySelector('form .btn.primary')`)
}, `!!document.querySelector('.onboarding')`, 12)

console.log('App installabile e aggiornamento')
await step(A1, 'il service worker controlla la pagina', () => A1.reload(), `!!navigator.serviceWorker.controller`, 12)
await step(A1, 'senza rete l\'app si apre lo stesso, con i dati', async () => { await A1.offline(true); await A1.reload(); await toList(A1) }, `${appReady} && /12,50/.test(document.body.innerText)`, 12)
await A1.offline(false)
await step(A1, 'nuova versione pubblicata: l\'app si aggiorna e i dati locali restano', async () => {
  await api('root', { fixture: 'v2' }); await A1.reload(); await sleep(2500); await A1.reload(); await toList(A1)
}, `!!document.querySelector('meta[name=e2e-build]') && ${appReady} && /12,50/.test(document.body.innerText)`, 20)

// nessuna chiamata dell'app deve finire su una rotta che il gateway Alpha rifiuta (le funzioni senza rotta sono spente);
// le foto profilo usano lo Storage di Supabase, che il finto backend non imita
const denied = [...new Set((await remote('A')).denied)].filter(r => !r.includes('/storage/v1/object/avatars/'))
if (denied.length) { console.error(`\nChiamate rifiutate dal gateway Alpha: ${denied.join(', ')}`); failed = true }
else console.log('\nNessuna chiamata dell\'app rifiutata dal gateway Alpha.')
const pageErrors = devices.flatMap(d => d.errors ?? [])
for (const d of [A1, A2, N]) if (d.errors.length) { console.error(`\nErrori nella pagina (${d.name}):\n  ${d.errors.join('\n  ')}`); failed = true }
if (!failed && !pageErrors.length) console.log(`\nTutti i ${n} passi Alpha sono andati bene (backend simulato).`)
await done(failed ? 1 : 0)
