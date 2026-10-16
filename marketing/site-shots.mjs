// Schermate vere dell'app per il sito (telefono in apertura e "Una giornata con Quadriamo"), con i DATI DI ESEMPIO.
// Uso: node marketing/site-shots.mjs  (server di sviluppo acceso), poi python3 tools/site_images.py
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openChrome, sleep } from '../tools/chrome.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173/app/'
// OUT_DIR: cartella diversa (es. per il controllo visivo prima/dopo una modifica)
const OUT = (process.env.OUT_DIR ?? new URL('./site-shots/', import.meta.url).pathname).replace(/\/?$/, '/')
mkdirSync(OUT, { recursive: true })

const { cdp, js, close } = await openChrome({ args: ['--lang=it-IT', '--hide-scrollbars'], onError: e => console.warn('errore nella pagina:', e) })
const shot = async (name, prep = '') => {
  if (prep) { await js(prep); await sleep(700) }
  const { result } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  writeFileSync(join(OUT, name), Buffer.from(result.data, 'base64')); console.log(name)
}

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
  await js(`location.hash = '#/'`); await sleep(600)
}
await close()
