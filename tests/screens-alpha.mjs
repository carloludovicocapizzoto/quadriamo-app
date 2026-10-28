// Fotografie delle schermate nuove dell'Alpha (conflitto tra due dispositivi, pannello della sincronizzazione,
// avviso di sessione terminata), in chiaro e in scuro, a 390×844: servono a confrontarle con il design system.
// Usa l'app Alpha già costruita in dist-alpha-e2e (npm run e2e:alpha) e il finto backend. Uso: node tests/screens-alpha.mjs [cartella]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openChrome, sleep } from '../tools/chrome.mjs'
import { startFakeAlpha, USERS } from './fake-alpha.mjs'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const out = resolve(process.argv[2] ?? join(root, 'screens-alpha'))
mkdirSync(out, { recursive: true })
const server = await startFakeAlpha({ fixtures: { v1: join(root, 'dist-alpha-e2e') } })
const devices = []
const until = async (d, expr, ms = 10000) => { for (let i = 0; i < ms / 100; i++) { if (await d.js(expr)) return true; await sleep(100) } return false }

async function device(port) {
  const c = await openChrome({ port, args: ['--lang=it-IT'], waitMs: 45_000 })
  devices.push(c)
  await c.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await c.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await c.cdp('Network.enable')
  const d = { ...c, type: async t => { for (const ch of t) await c.cdp('Input.insertText', { text: ch }) },
    offline: on => c.cdp('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }) }
  await c.cdp('Page.navigate', { url: server.origin + '/app/' }); await sleep(1500)
  await c.js(`localStorage.setItem('quadriamo.lang', 'it')`); await c.cdp('Page.reload'); await sleep(1800)
  return d
}
async function signIn(d, who) {
  if (await d.js(`!!document.querySelector('.gate-cta')`)) { await d.js(`document.querySelector('.gate-cta').click()`); await sleep(700) }
  if (await d.js(`!!document.querySelector('.inst-skip')`)) { await d.js(`document.querySelector('.inst-skip').click()`); await sleep(700) }
  await d.js(`document.querySelector('input[type=email]').focus()`); await d.type(USERS[who].email)
  await d.js(`document.querySelector('form .btn.primary').click()`); await sleep(600)
  await d.js(`document.querySelector('input[type=password]').focus()`); await d.type(USERS[who].password)
  await d.js(`document.querySelector('form .btn.primary').click()`)
}
async function shoot(d, name) {
  for (const scheme of ['light', 'dark']) {
    await d.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
    await sleep(900)
    const shot = await d.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(join(out, `${name}-${scheme}.png`), Buffer.from(shot.result.data, 'base64'))
  }
}
const setStartDay = async (d, day) => {
  await d.js(`location.hash = '#/profile/budget'`); await until(d, `!!document.querySelector('input[type=number][max="28"]')`)
  await d.js(`(() => { const el = document.querySelector('input[type=number][max="28"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${day}');
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) })()`); await sleep(800)
}

const A1 = await device(9491)
await signIn(A1, 'A'); await until(A1, `!!document.querySelector('.onboarding')`, 15000)
await A1.js(`document.querySelector('.onboarding .btn.primary').click()`); await sleep(700)
await A1.js(`document.querySelector('.persona-row')?.click()`); await sleep(500)
for (let i = 0; i < 14 && !(await A1.js(`!!document.querySelector('.tabbar')`)); i++) { await A1.js(`document.querySelector('.step-nav .btn.primary')?.click()`); await sleep(450) }
await sleep(2500)
// PAGES=1: pagine intere di tutti i menu (tema scuro), per controllare compattezza e chiarezza; poi si esce
if (process.env.PAGES) {
  const routes = ['#/', '#/analysis/month', '#/analysis/year', '#/analysis/calendar', '#/analysis/investments', '#/analysis/transactions', '#/news',
    '#/profile', '#/profile/personal', '#/profile/security', '#/profile/plan', '#/profile/budget', '#/profile/capital', '#/profile/recurring',
    '#/profile/goals', '#/profile/documents', '#/profile/rules', '#/profile/appearance', '#/profile/language', '#/profile/inbox',
    '#/profile/notifications', '#/profile/motion', '#/profile/accessibility', '#/profile/data', '#/profile/help', '#/profile/feedback']
  await A1.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.SCHEME ?? 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  for (const route of routes) {
    await A1.js(`location.hash = '${route}'`); await sleep(1400); await A1.js(`window.scrollTo(0, 0)`)
    const height = Math.min(6000, await A1.js(`document.documentElement.scrollHeight`))
    await A1.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true }); await sleep(500)
    const shot = await A1.cdp('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(out, `${route.replace(/[#/]+/g, '-').replace(/^-|-$/g, '') || 'home'}.png`), Buffer.from(shot.result.data, 'base64'))
    await A1.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  }
  for (const d of devices) await d.close()
  await server.close(); console.log(`Pagine in ${out}`); process.exit(0)
}
const A2 = await device(9492)
await signIn(A2, 'A'); await until(A2, `!!document.querySelector('.tabbar')`, 15000); await sleep(2000)

// 1. pannello della sincronizzazione in Profilo → Esporta e importa (tutto in ordine)
await A1.js(`location.hash = '#/profile/data'`); await sleep(1200); await shoot(A1, '1-sincronizzazione')
// 2. offline
await A1.offline(true); await A1.js(`location.hash = '#/'`); await sleep(1500); await shoot(A1, '2-offline')
// 3. conflitto: lo stesso campo cambiato in modo diverso sui due dispositivi
await A2.offline(true); await setStartDay(A1, 10); await setStartDay(A2, 20)
await A1.offline(false); await sleep(3000); await A2.offline(false)
await until(A2, `!!document.querySelector('.cloud-conflict')`, 15000)
await A2.js(`window.scrollTo(0, 0)`); await shoot(A2, '3-conflitto')
// 4. avviso di sessione terminata
await A1.js(`(() => { const k = Object.keys(localStorage).find(x => x.startsWith('q.auth.v1/'))
  localStorage.setItem(k, JSON.stringify({ format: 1, generation: 'shot', session: null })); window.dispatchEvent(new StorageEvent('storage', { key: k })) })()`)
await sleep(2500); await shoot(A1, '4-sessione-terminata')

for (const d of devices) await d.close()
await server.close()
console.log(`Schermate in ${out}`)
