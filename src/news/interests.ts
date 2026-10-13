// Cosa ti interessa nelle Notizie: si impara da quello che apri e resta solo su questo telefono (il server non lo sa).
import type { HubItem } from './hub'

export type Interests = Record<string, number>   // "cat:etf", "format:video", "level:beginner" -> peso
const KEY = 'q.interests'
export const loadInterests = (): Interests => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }

/** Un contenuto aperto rinforza le sue categorie, il formato e il livello; i gusti vecchi sbiadiscono piano. */
export function learn(i: Interests, item: HubItem): Interests {
  const next: Interests = {}
  for (const [k, v] of Object.entries(i)) if (v * 0.95 > 0.05) next[k] = v * 0.95
  for (const k of [...item.categories.map(c => `cat:${c}`), `format:${item.format}`, `level:${item.level}`]) next[k] = (next[k] ?? 0) + 1
  return next
}
export function remember(item: HubItem) {
  try { localStorage.setItem(KEY, JSON.stringify(learn(loadInterests(), item))) } catch { /* niente */ }
}
export function forget() { try { localStorage.removeItem(KEY) } catch { /* niente */ } }
