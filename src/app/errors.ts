// Errori dell'app: se qualcosa si rompe sul telefono di un utente, arriva all'area admin (tabella client_errors).
// Solo dati tecnici, le email nei messaggi vengono oscurate; al massimo 5 errori diversi per apertura dell'app.
import { APP_VERSION } from '../beta/device'
import { supabase } from '../sync/client'

const sent = new Set<string>()
// rumore che non dice niente: estensioni del browser, script di terzi, sezioni non scaricate perché offline
const NOISE = /ResizeObserver loop|Script error\.?$|dynamically imported module|module script failed|Load failed|NetworkError|Failed to fetch/i

const platform = () => {
  const ua = navigator.userAgent
  const os = /iPhone|iPad|Android|Mac|Windows|Linux/.exec(ua)?.[0] ?? 'altro'
  const installed = matchMedia('(display-mode: standalone)').matches ? ' app' : ' browser'
  return (os + installed).slice(0, 40)
}

export function reportError(e: unknown) {
  if (!supabase || !navigator.onLine || sent.size >= 5) return
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e)?.slice(0, 300) ?? 'errore')
  const message = (err.message || 'errore').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').slice(0, 300)
  if (NOISE.test(message) || sent.has(message)) return
  sent.add(message)
  void supabase.from('client_errors').insert({
    message, stack: (err.stack ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').slice(0, 2000),
    route: (location.hash.split('?')[0] || '#/').slice(0, 80), version: APP_VERSION, platform: platform(),
  }).then(() => undefined, () => undefined)
}

/** Ascolta gli errori non gestiti (una volta, all'avvio). */
export function watchErrors() {
  window.addEventListener('error', e => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', e => reportError(e.reason))
}
