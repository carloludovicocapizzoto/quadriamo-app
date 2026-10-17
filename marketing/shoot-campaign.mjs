// Schermate per la campagna (app 0.20): Home con «Adesso», widget, calendario, promemoria, notifiche, abbonamenti,
// costo annuale, ricevuta del mese, documenti, capitale, notizie, computer. Sempre con i DATI DI ESEMPIO, a cui lo script
// aggiunge (dall'interfaccia, come una persona) alcuni abbonamenti, due documenti e una bolletta da seguire.
// Uso, con il server di sviluppo acceso (porta 5173):  THEME=light|dark LANG_APP=it|en node marketing/shoot-campaign.mjs
// Le immagini vanno in marketing/shots-campaign/<tema>/ (italiano) o <lingua>-<tema>/ (es. en-dark), telefono 375x812 x3
// = 1125x2436; computer 1440x900 x2. I pulsanti si trovano per testo: le etichette sono in L (una per lingua).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openChrome, sleep } from '../tools/chrome.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173/app/'
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light'
const LANG = process.env.LANG_APP === 'en' ? 'en' : 'it'
const L = {
  it: { browser: /browser/i, demo: /dati di esempio/i, no: /^No/, addSub: /Aggiungi abbonamento/, card: 'Carta', addCal: /Aggiungi al calendario/, save: /^Salva$/,
    later: /Non ora|Più tardi/, addDoc: /Aggiungi documento/, addDocExact: /^Aggiungi documento$/, car: 'Auto', personal: 'Personali', licence: 'Patente',
    carIns: 'Assicurazione auto', passport: 'Passaporto', newEvent: /Nuovo evento/, bill: 'Bolletta', billName: 'Luce e gas', customize: /Personalizza/,
    wMonth: 'Questo mese', wSubs: 'Abbonamenti', wDocs: 'Documenti', agenda: /^Agenda$/, month: /^Mese$/, without: /Prova senza/, receipt: /Ricevuta del mese/,
    dec: ',', inbox: [['Domani: Affitto', '380,00 € · sabato 1 novembre'], ['Oggi puoi spendere', 'Essenziali 18,13 € · Qualità della vita 38,21 €'],
      ['Tra 7 giorni: Patente', 'martedì 8 novembre'], ['Notizia importante', 'BCE: tassi fermi, cosa cambia per mutui e conti deposito']] },
  en: { browser: /browser/i, demo: /sample data/i, no: /^No/, addSub: /Add subscription/, card: 'Card', addCal: /Add to calendar/, save: /^Save$/,
    later: /Not now|Later/, addDoc: /Add document/, addDocExact: /^Add document$/, car: 'Car', personal: 'Personal', licence: 'Driving licence',
    carIns: 'Car insurance', passport: 'Passport', newEvent: /New event/, bill: 'Bill', billName: 'Electricity and gas', customize: /Customize/,
    wMonth: 'This month', wSubs: 'Subscriptions', wDocs: 'Documents', agenda: /^Agenda$/, month: /^Month$/, without: /Try without it/, receipt: /Monthly receipt/,
    dec: '.', inbox: [['Tomorrow: Rent', '€380.00 · Saturday 1 November'], ['Today you can spend', 'Essentials €18.13 · Quality of life €38.21'],
      ['In 7 days: Driving licence', 'Tuesday 8 November'], ['Top story', 'ECB holds rates: what it means for mortgages and savings']] },
}[LANG]
const money = v => v.replace(',', L.dec)
const OUT = new URL(`./shots-campaign/${LANG === 'it' ? THEME : `${LANG}-${THEME}`}/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const { cdp, js, close } = await openChrome({ port: 9411, args: [`--lang=${LANG === 'en' ? 'en-GB' : 'it-IT'}`, '--hide-scrollbars'], onError: e => console.warn('errore nella pagina:', e) })
const shot = async name => {
  await sleep(500)
  const { result } = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, name), Buffer.from(result.data, 'base64')); console.log(THEME, name)
}
const go = async (hash, wait = 1300) => { await js(`location.hash = '${hash}'`); await sleep(wait); await js(clean) }
const top = () => js('window.scrollTo(0, 0)')
const scrollTo = async (sel, offset = 16) => { await js(`(() => { const el = document.querySelector('${sel}'); if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -${offset}) } })()`); await sleep(400) }
const clickText = async (re, scope = 'button') => {
  const ok = await js(`(() => { const el = [...document.querySelectorAll('${scope}')].find(b => ${re}.test(b.textContent.trim())); el?.click(); return !!el })()`)
  if (!ok) console.warn('non trovato:', re, scope)
  await sleep(700)
}
const setVal = (sel, v) => js(`(() => { const el = document.querySelector('${sel}'); if (!el) return false
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, ${JSON.stringify(v)})
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
const closeSheet = async () => { await js(`document.querySelector('.bs-root.open')?.click()`); await sleep(600) }
const iso = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
// il riquadro "dati di esempio" e il consenso si nascondono con lo stile (toglierli confonderebbe React)
const clean = `if (!document.getElementById('shot-css')) { const st = document.createElement('style'); st.id = 'shot-css';
  st.textContent = '.demo-banner, .consent, .update-toast { display: none !important }'; document.head.append(st) }`

const phone = () => cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 3, mobile: true })
await phone()
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: THEME }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
await cdp('Page.navigate', { url: APP }); await sleep(1500)
await js(`localStorage.clear(); indexedDB.deleteDatabase('keyval-store'); localStorage.setItem('quadriamo.lang', '${LANG}'); localStorage.setItem('q.calMode', 'month')`)
await cdp('Page.reload'); await sleep(2500)
await js(`document.querySelector('.gate-cta')?.click()`); await sleep(900)
await clickText(L.browser); await clickText(L.demo); await sleep(1500)
await clickText(L.no); await js(clean)

// ---------- dati in più, dall'interfaccia ----------
await go('#/profile/recurring')
const addSub = async (name, price, day, edit) => {
  await clickText(L.addSub)
  await setVal('.sp input[type=search]', name); await sleep(400)
  await js(`document.querySelector('.sp-list .row')?.click()`); await sleep(900)
  await setVal('.event-form input[inputmode=decimal]', money(price)); await setVal('.event-form input[type=date]', iso(day)); await sleep(200)
  await js(`[...document.querySelectorAll('.event-form [role=radio]')].find(b => b.textContent === ${JSON.stringify(L.card)})?.click()`)
  await clickText(L.addCal, '.event-form button'); await sleep(600)
  await js(`[...document.querySelectorAll('button')].find(b => ${L.later}.test(b.textContent))?.click()`); await sleep(200)
  if (edit) {   // un aumento di prezzo, per lo storico
    await js(`[...document.querySelectorAll('.subs-list .row')].find(r => r.textContent.includes(${JSON.stringify(name)}))?.click()`); await sleep(900)
    await setVal('.event-form input[inputmode=decimal]', money(edit)); await sleep(200)
    await clickText(L.save, '.event-form button'); await sleep(600)
  }
}
// date sparse nel mese (mai oggi: il numero del giorno resta realistico)
for (const [n, p, d, e] of [['Netflix', '12,99', 3, '17,99'], ['DAZN', '34,99', -6], ['ChatGPT', '23', 9], ['Disney', '8,99', 12], ['iCloud', '2,99', -10], ['Amazon Prime', '49,90', 40]]) await addSub(n, p, d, e)

await go('#/profile/documents')
const addDoc = async (cat, preset, date) => {
  await clickText(L.addDoc)
  await js(`[...document.querySelectorAll('.event-form [role=radio]')].find(b => b.textContent === ${JSON.stringify(cat)})?.click()`); await sleep(200)
  await js(`[...document.querySelectorAll('.doc-preset')].find(b => b.textContent === ${JSON.stringify(preset)})?.click()`); await sleep(200)
  await setVal('.event-form input[type=date]', date); await sleep(200)
  await clickText(L.addDocExact, '.event-form button'); await sleep(600)
  await js(`[...document.querySelectorAll('button')].find(b => ${L.later}.test(b.textContent))?.click()`)
}
await addDoc(L.car, L.licence, iso(22)); await addDoc(L.car, L.carIns, iso(140)); await addDoc(L.personal, L.passport, iso(900))

// una bolletta da seguire "finché non è fatta", scaduta due giorni fa: in «Adesso» compare con «Fatto»
await go('#/analysis/calendar')
await clickText(L.newEvent)
await js(`[...document.querySelectorAll('.event-form [role=radio]')].find(b => b.textContent === ${JSON.stringify(L.bill)})?.click()`); await sleep(200)
await setVal('.event-form .ev-name input', L.billName); await setVal('.event-form input[inputmode=decimal]', '62')
await setVal('.event-form input[type=date]', iso(-2)); await sleep(200)
await js(`(() => { const c = document.querySelector('.event-form input[type=checkbox]'); if (c && !c.checked) c.click() })()`); await sleep(200)
await clickText(L.addCal, '.event-form button'); await sleep(600)

// widget nuovi in Home, «Questo mese» tra i preferiti
await go('#/')
await clickText(L.customize)
for (const n of [L.wMonth, L.wSubs, L.wDocs]) await js(`[...document.querySelectorAll('.wg-btn.add')].find(b => b.getAttribute('aria-label').includes(${JSON.stringify(n)}))?.click()`)
await sleep(400)
await js(`[...document.querySelectorAll('.wg-tile')].find(li => li.querySelector('.wg-name')?.textContent === ${JSON.stringify(L.wMonth)})?.querySelector('.wg-fav')?.click()`)
await sleep(300); await shot('22-widget-gallery.png')
await closeSheet()

// ---------- le schermate ----------
await go('#/', 1800); await top(); await shot('01-home.png')
await scrollTo('.home-grid'); await shot('02-home-widgets.png')
await scrollTo('.w-subscriptions'); await shot('03-home-widgets-2.png')

await go('#/analysis/calendar'); await scrollTo('.cal-summary', 70); await shot('04-calendar.png')
await scrollTo('.cal-week-title', 260); await shot('05-calendar-week.png')
await clickText(L.agenda, '.cal-modes .chip'); await scrollTo('.tl', 120); await shot('06-calendar-agenda.png')
await clickText(L.month, '.cal-modes .chip')
await clickText(L.newEvent); await scrollTo('.event-form .fb-q:last-of-type', 0); await js(`document.querySelector('.bs')?.scrollTo(0, 99999)`); await sleep(400); await shot('07-event-reminders.png'); await closeSheet()

await go('#/profile/notifications'); await top(); await shot('08-notifications.png')
// centro notifiche: tre notifiche come le salverebbe il service worker
await js(`new Promise(ok => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => { const tx = r.result.transaction('keyval', 'readwrite')
  const now = Date.now(), at = h => new Date(now - h * 36e5).toISOString()
  tx.objectStore('keyval').put([
    { id: 'n1', at: at(1), kind: 'reminder', title: ${JSON.stringify(L.inbox[0][0])}, body: ${JSON.stringify(L.inbox[0][1])}, url: './app/' },
    { id: 'n2', at: at(5), kind: 'morning', title: ${JSON.stringify(L.inbox[1][0])}, body: ${JSON.stringify(L.inbox[1][1])}, url: './app/', opened: true },
    { id: 'n3', at: at(26), kind: 'reminder', title: ${JSON.stringify(L.inbox[2][0])}, body: ${JSON.stringify(L.inbox[2][1])}, url: './app/' },
    { id: 'n4', at: at(50), kind: 'news', title: ${JSON.stringify(L.inbox[3][0])}, body: ${JSON.stringify(L.inbox[3][1])}, url: './app/?tab=news' },
  ], 'quadriamo.inbox'); tx.oncomplete = ok } })`)
await go('#/profile/inbox'); await top(); await shot('09-inbox.png')

await go('#/profile/recurring'); await top(); await shot('10-subscriptions.png')
await clickText(L.addSub); await sleep(700); await shot('11-service-picker.png')
await setVal('.sp input[type=search]', 'spo'); await sleep(500); await shot('12-service-search.png'); await closeSheet()
await go('#/profile/yearCost', 1600); await top(); await shot('13-year-cost.png')
await js(`[...document.querySelectorAll('.yc-tile')].find(b => /DAZN/.test(b.getAttribute('aria-label')))?.click()`); await sleep(1000); await shot('14-year-cost-detail.png')
await clickText(L.without, '.bs-body button'); await sleep(1200); await top(); await shot('15-year-cost-without.png')

await go('#/analysis/month', 1500)
await clickText(L.receipt); await sleep(2200); await shot('16-receipt.png')
await js(`document.querySelector('.bs')?.scrollTo(0, 99999)`); await sleep(500); await shot('17-receipt-end.png'); await closeSheet()

await go('#/profile/documents'); await top(); await shot('18-documents.png')
await go('#/profile/capital'); await top(); await shot('19-capital.png')

try {
  const sample = readFileSync(new URL('../tools/news/sample.json', import.meta.url), 'utf8')
  await js(`localStorage.setItem('q.hub', JSON.stringify({ lang: 'it', at: Date.now(), items: ${sample}.filter(x => x.lang === '${LANG}' || x.lang === 'en') }))`)
  await go('#/news', 1800); await top(); await shot('20-news.png')
  await js(`document.querySelector('.news-filter-btn')?.click()`); await sleep(900); await shot('21-news-filters.png'); await closeSheet()
} catch (e) { console.warn('notizie:', e.message) }

await go('#/'); await js(`document.querySelector('.tab-add')?.click()`); await sleep(900)
for (const ch of money('4,50')) await cdp('Input.insertText', { text: ch })
await sleep(400); await shot('23-add.png'); await closeSheet()

// pagine intere (senza la barra in basso), per i reel che scorrono: lo schermo diventa alto quanto la pagina
const tall = async (name, hash, h, prep = '') => {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: h, deviceScaleFactor: 3, mobile: true })
  await go(hash, 1600); await js(`document.getElementById('tall-css') || document.head.append(Object.assign(document.createElement('style'), { id: 'tall-css', textContent: '.tabbar, .bottom-nav, nav.tabbar { display: none !important }' }))`)
  if (prep) { await js(prep); await sleep(2200) }
  await top(); await shot(name)
  await js(`document.getElementById('tall-css')?.remove()`)
  await phone()
}
await tall('40-tall-home.png', '#/', 2300)
await tall('41-tall-receipt.png', '#/analysis/month', 2900, `[...document.querySelectorAll('button')].find(b => ${L.receipt}.test(b.textContent))?.click()`)
await closeSheet()
await tall('42-tall-calendar.png', '#/analysis/calendar', 2100)

// computer: la stessa Home come dashboard a più colonne
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
await go('#/', 1800); await top(); await shot('30-desktop-home.png')
await go('#/analysis/calendar', 1600); await top(); await shot('31-desktop-calendar.png')
await cdp('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true })
await go('#/', 1800); await top(); await shot('32-tablet-home.png')
await close()
