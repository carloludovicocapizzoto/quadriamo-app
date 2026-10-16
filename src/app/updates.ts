// Aggiornamenti senza attrito: l'app installata non aspetta di essere riaperta da zero (su iPhone può restare
// in secondo piano per giorni). Cerca una versione nuova ogni volta che torna in primo piano e ogni ora se resta
// aperta; se c'è, si ricarica subito, al ritorno, prima che si cominci a scrivere. Poi dice a che versione è passata.
import { registerSW } from 'virtual:pwa-register'
import { ENV } from '../env'
import { local } from '../storage'

const SEEN = 'q.seenRelease'

export function watchUpdates() {
  if (!('serviceWorker' in navigator) || ENV.name === 'development') return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => { if (document.visibilityState === 'visible' && navigator.onLine) void reg.update().catch(() => undefined) }
      document.addEventListener('visibilitychange', check)
      setInterval(check, 60 * 60e3)
    },
  })
}

/** La versione appena arrivata, da annunciare una volta: ai tester a ogni build, agli altri a ogni versione. */
export function newRelease(): string | null {
  const seen = local.get(SEEN)
  local.set(SEEN, ENV.release)
  if (!seen) return null   // primo avvio: niente da annunciare
  const changed = ENV.flags.tester ? seen !== ENV.release : seen.split('+')[0] !== ENV.version
  return changed ? ENV.label : null
}
