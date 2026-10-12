// Notifica del mattino "Oggi puoi spendere…": l'app salva sul dispositivo un piccolo riepilogo (quanto resta libero in ogni
// parte e fino a quando); la mattina il service worker (public/push-sw.js) lo legge e calcola il numero del giorno.
// Così gli importi non passano mai dal server: arriva solo la "sveglia".
import { set } from 'idb-keyval'

export const MORNING_KEY = 'quadriamo.morning'

export interface MorningSnapshot {
  lang: string; currency: string; end: string            // fine del periodo (YYYY-MM-DD)
  items: { name: string; free: number }[]                 // libero per parte (già al netto dei pagamenti in arrivo)
  updatedAt: string
  streak?: number; lastActive?: string                    // slancio: per il testo delle notifiche "a sorpresa"
}

export async function saveMorningSnapshot(s: MorningSnapshot | null) {
  try { await set(MORNING_KEY, s) } catch { /* archivio non disponibile */ }
}

