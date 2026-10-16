// Promemoria del calendario sul server (tabella push_reminders, 0029): il telefono li calcola (engine/reminders) e
// li manda con solo l'ora e i nomi degli eventi. Gli importi restano qui: il service worker (public/push-sw.js) li legge
// da IndexedDB ("quadriamo.reminders") e li aggiunge al testo della notifica. Le categorie accese vanno al server per
// ogni dispositivo iscritto (set_push_prefs), così le notifiche del mattino, i solleciti e le notizie rispettano le scelte.
import { set } from 'idb-keyval'
import { DEFAULT_NOTIFY, planReminders, type CalEvent, type NotifyPrefs } from '../engine'
import { supabase } from '../sync/client'
import { pushSupported } from './push'

const SNAPSHOT_KEY = 'quadriamo.reminders'
const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const notifyPrefs = (p: NotifyPrefs | undefined): NotifyPrefs => ({ ...DEFAULT_NOTIFY, ...p })

/** Ricalcola i promemoria dei prossimi giorni e li sostituisce sul server. Senza account o senza rete non fa niente. */
export async function syncReminders(events: CalEvent[], prefs: NotifyPrefs, currency: string, lang: string): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  const planned = planReminders(events, prefs, local(new Date()))
  // gli importi per il service worker: per nome dell'evento, solo su questo telefono
  const amounts = Object.fromEntries(events.filter(e => e.amount != null).map(e => [e.title, e.amount]))
  try { await set(SNAPSHOT_KEY, { lang, currency, amounts }) } catch { /* archivio non disponibile: la notifica avrà solo il nome */ }
  // l'ora locale del telefono diventa un istante preciso (il server ragiona in UTC)
  const rows = planned.map(p => ({ at: new Date(p.at).toISOString(), day: p.date, titles: p.titles }))
  await supabase.rpc('replace_reminders', { p_rows: rows })
}

/** Le categorie accese per questo dispositivo, sul server. Con il server di prima del 0029 si usano le due chiamate vecchie. */
export async function syncPushPrefs(prefs: NotifyPrefs): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  if (!sub || !supabase) return
  const { error } = await supabase.rpc('set_push_prefs', { p_endpoint: sub.endpoint, p_morning: prefs.morning, p_news: prefs.news, p_nudge: prefs.nudge, p_reminders: prefs.reminders })
  if (error) {
    await supabase.rpc('set_morning_push', { p_endpoint: sub.endpoint, p_on: prefs.morning })
    await supabase.rpc('set_news_push', { p_endpoint: sub.endpoint, p_on: prefs.news })
  }
}
