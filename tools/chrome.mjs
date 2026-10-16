// Chrome senza finestra guidato dal protocollo DevTools: lo usano i test che usano l'app (tests/e2e.mjs)
// e gli scatti per i contenuti e per il sito (marketing/). Profilo usa e getta, cancellato alla chiusura
// (senza, ogni giro lascia centinaia di MB nella cartella temporanea).
// Chrome: CHROME=/percorso/del/chrome, altrimenti quello del Mac o google-chrome (GitHub Actions).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
  .find(p => existsSync(p)) ?? 'google-chrome'
export const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Apre Chrome e si collega alla prima pagina. `onError` riceve gli errori della pagina (prima riga).
 * Sui server di GitHub Chrome gira senza sandbox e può metterci un po' a partire: si aspetta fino a `waitMs`.
 */
export async function openChrome({ port = 9333, args = [], waitMs = 10_000, onError = () => {} } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'qshot-'))
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), ...args, 'about:blank'], { stdio: 'ignore' })
  let ws
  const close = async () => {
    try { ws?.close() } catch { /* già chiuso */ }
    chrome.kill(); await new Promise(r => chrome.once('exit', r))
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }) } catch { /* Chrome scrive ancora: la cartella la pulisce il sistema */ }
  }

  let target
  for (let i = 0; i < waitMs / 250 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page') } catch { /* non ancora */ }
    if (!target) await sleep(250)
  }
  if (!target) { await close(); throw new Error(`Chrome non è partito in ${waitMs / 1000} secondi`) }

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r, { once: true }))
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.method === 'Runtime.exceptionThrown') onError(m.params.exceptionDetails.exception?.description?.split('\n')[0] ?? 'errore')
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const js = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
  await cdp('Page.enable'); await cdp('Runtime.enable')
  return { cdp, js, close }
}
