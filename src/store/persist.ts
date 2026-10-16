// Salvataggio sul dispositivo (IndexedDB). Niente server: i dati restano qui finché non arriva la sincronizzazione.
import { del, get, set } from 'idb-keyval'
import type { AppData } from './state'

const KEY = 'quadriamo.data.v1'

export async function loadData(): Promise<AppData | null> {
  try { return (await get<AppData>(KEY)) ?? null } catch { return null }
}

export async function saveData(d: AppData | null): Promise<void> {
  if (d) await set(KEY, d)
  else await del(KEY)
}

/** Chiede al browser di non cancellare i dati quando lo spazio scarseggia (dove supportato). */
export async function requestPersistence(): Promise<void> {
  try { await navigator.storage?.persist?.() } catch { /* non supportato */ }
}
