// Notifica del mattino "Oggi puoi spendere…": l'app salva sul dispositivo un piccolo riepilogo (quanto resta libero in ogni
// parte e fino a quando); la mattina il service worker (public/push-sw.js) lo legge e calcola il numero del giorno.
// Così gli importi non passano mai dal server: arriva solo la "sveglia".
import { set } from 'idb-keyval'
import { supabase } from '../sync/client'

export const MORNING_KEY = 'quadriamo.morning'
const PREF = 'q.morning'

export interface MorningSnapshot {
  lang: string; currency: string; end: string            // fine del periodo (YYYY-MM-DD)
  items: { name: string; free: number }[]                 // libero per parte (già al netto dei pagamenti in arrivo)
  updatedAt: string
}

export async function saveMorningSnapshot(s: MorningSnapshot | null) {
  try { await set(MORNING_KEY, s) } catch { /* archivio non disponibile */ }
}

export const morningWanted = () => { try { return localStorage.getItem(PREF) !== 'off' } catch { return true } }

/** Attiva o spegne la notifica del mattino per questo dispositivo (serve avere già le notifiche attive). */
export async function setMorning(on: boolean) {
  try { localStorage.setItem(PREF, on ? 'on' : 'off') } catch { /* niente */ }
  if (!supabase || !('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await supabase.rpc('set_morning_push', { p_endpoint: sub.endpoint, p_on: on })
}
