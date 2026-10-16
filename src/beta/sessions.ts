// Statistiche d'uso per sessione (tabella usage_sessions, migrazione 0025), SOLO con il consenso alle statistiche anonime.
// Si ricavano dal diario tecnico (app/diagnostics.ts): secondi per schermata, percorso tra le schermate, quante volte
// ogni tipo di azione, rallentamenti, errori, l'ultima schermata prima di uscire. Mai importi, testi o nomi.
// Una sola richiesta quando l'app va in secondo piano: niente traffico mentre la si usa. Dopo 30 minuti fuori
// dall'app, al ritorno inizia una sessione nuova.
import { ENV } from '../env'
import { onNote, route } from '../app/diagnostics'
import { deviceId, isStandalone, platform, statsConsent, uuid } from './device'

const IDLE_MS = 30 * 60e3
const MAX_PATH = 30

let session = uuid()
let hiddenAt = 0
let here = route()
let since = performance.now(), started = since
let screens: Record<string, number> = {}, path: string[] = [], actions: Record<string, number> = {}, slow = 0, errors = 0

/** Il tempo passato sulla schermata attuale va nel suo conto. */
function leave() {
  const now = performance.now()
  screens[here] = (screens[here] ?? 0) + (now - since) / 1000
  since = now
}

function flush() {
  leave()
  const seconds = Math.round((performance.now() - started) / 1000)
  const sb = ENV.supabase
  if (seconds >= 1 && sb && statsConsent() === 'yes' && navigator.onLine) {
    // keepalive: la richiesta parte anche se il sistema chiude l'app subito dopo
    void fetch(`${sb.url}/rest/v1/usage_sessions`, {
      method: 'POST', keepalive: true,
      headers: { apikey: sb.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        session_id: session, device_id: deviceId(), seconds,
        screens: Object.fromEntries(Object.entries(screens).map(([k, v]) => [k, Math.round(v)])),
        path, actions, slow, errors, last_screen: here,
        env: ENV.name, version: ENV.release, platform: platform(), installed: isStandalone(),
      }),
    }).catch(() => undefined)
  }
  screens = {}; path = [here]; actions = {}; slow = 0; errors = 0
}

/** Una volta, all'avvio. */
export function watchSessions() {
  path = [here]
  onNote(e => {
    if (e.kind === 'nav') { leave(); here = e.what; if (path.at(-1) !== here && path.length < MAX_PATH) path.push(here) }
    else if (e.kind === 'action') actions[e.what] = (actions[e.what] ?? 0) + 1
    else if (e.kind === 'slow') slow++
    else if (e.kind === 'error') errors++
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); flush(); return }
    if (Date.now() - hiddenAt > IDLE_MS) session = uuid()
    since = started = performance.now()   // il tempo fuori dall'app non conta
  })
}
