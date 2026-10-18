// Errori dell'app: se qualcosa si rompe sul telefono di un utente, arriva all'area admin (tabella client_errors)
// con gli ultimi passi del diario tecnico (diagnostics.ts), l'ambiente e il commit, così si può ricostruire.
// Solo dati tecnici, le email nei messaggi vengono oscurate; al massimo 5 errori diversi per apertura dell'app.
import { ENV } from '../env'
import { scopedClient } from '../sync/scopedClient'
import { currentScope } from '../store/scope'
import { deviceInfo, note, route, trailNow } from './diagnostics'

const sent = new Set<string>()
// rumore che non dice niente: estensioni del browser, script di terzi, sezioni non scaricate perché offline
const NOISE = /ResizeObserver loop|Script error\.?$|dynamically imported module|module script failed|Load failed|NetworkError|Failed to fetch/i
const hideEmails = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')

export function reportError(e: unknown) {
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e)?.slice(0, 300) ?? 'errore')
  const message = hideEmails(err.message || 'errore').slice(0, 300)
  if (NOISE.test(message)) return
  note('error', message)
  const lease = currentScope(), supabase = scopedClient(lease, true)
  if (!supabase || !navigator.onLine || sent.size >= 5 || sent.has(message)) return
  sent.add(message)
  const d = deviceInfo()
  const base = { message, stack: hideEmails(err.stack ?? '').slice(0, 2000), route: route(), version: ENV.release,
    platform: `${d.os} ${d.installed ? 'app' : 'browser'}`.slice(0, 40) }
  const db = supabase
  // env, commit e diario arrivano con la migrazione 0024: prima di allora si manda l'errore senza
  void db.from('client_errors').insert({ ...base, env: ENV.name, commit: ENV.commit, trail: trailNow() })
    .then(({ error }) => error && lease.current() ? db.from('client_errors').insert(base) : null)
    .then(() => undefined, () => undefined)
}

/** Ascolta gli errori non gestiti (una volta, all'avvio). */
export function watchErrors() {
  addEventListener('error', e => reportError(e.error ?? e.message))
  addEventListener('unhandledrejection', e => reportError(e.reason))
}
