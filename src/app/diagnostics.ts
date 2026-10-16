// Diario tecnico dell'app: gli ultimi passi (schermate, azioni, rallentamenti, rete, errori) restano in memoria
// sul dispositivo e partono solo dentro una segnalazione d'errore o una segnalazione del tester, così un problema
// si può ricostruire. Niente importi, testi o nomi: solo percorsi e tipi di azione.
import { ENV } from '../env'
import { isStandalone, osName, platform } from '../beta/device'

export type TrailKind = 'nav' | 'action' | 'slow' | 'net' | 'error'
/** `s`: secondi dall'apertura dell'app. */
export interface TrailEntry { s: number; kind: TrailKind; what: string }

const MAX = 40
const opened = performance.now()
const trail: TrailEntry[] = []

export function note(kind: TrailKind, what: string) {
  trail.push({ s: Math.round((performance.now() - opened) / 100) / 10, kind, what: what.slice(0, 120) })
  if (trail.length > MAX) trail.shift()
}
export const trailNow = (): TrailEntry[] => trail.slice()
export const route = () => (location.hash.split('?')[0] || '#/').slice(0, 80)

/** Il dispositivo e la build, per capire dove è successo. */
export function deviceInfo() {
  return {
    platform: platform(), os: osName(), installed: isStandalone(), lang: document.documentElement.lang || navigator.language,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`, online: navigator.onLine,
    env: ENV.name, release: ENV.release, commit: ENV.commit,
  }
}

/** Ascolta schermate, rallentamenti (attese oltre 200 ms) e rete (una volta, all'avvio). */
export function watchDiagnostics() {
  note('nav', route())
  addEventListener('hashchange', () => note('nav', route()))
  addEventListener('online', () => note('net', 'online'))
  addEventListener('offline', () => note('net', 'offline'))
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (e.duration >= 200) note('slow', `${Math.round(e.duration)} ms su ${route()}`)
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* Safari non conosce longtask */ }
}
