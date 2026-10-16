// Cosa ti interessa nelle Notizie: si impara da quello che apri e resta solo su questo telefono (il server non lo sa).
import type { HubItem } from './hub'
import { local } from '../storage'

export type Interests = Record<string, number>   // "cat:etf", "format:video", "level:beginner" -> peso
const KEY = 'q.interests'
export const loadInterests = () => local.json<Interests>(KEY, {})

/** Un contenuto aperto rinforza le sue categorie, il formato e il livello; i gusti vecchi sbiadiscono piano. */
export function learn(i: Interests, item: HubItem): Interests {
  const next: Interests = {}
  for (const [k, v] of Object.entries(i)) if (v * 0.95 > 0.05) next[k] = v * 0.95
  for (const k of [...item.categories.map(c => `cat:${c}`), `format:${item.format}`, `level:${item.level}`]) next[k] = (next[k] ?? 0) + 1
  return next
}
export function remember(item: HubItem) {
  local.setJson(KEY, learn(loadInterests(), item))
}

// Gli argomenti che segui: parole scelte da te (es. "ETF", "mutuo", "Tesla"), solo su questo telefono
const TOPICS = 'q.newsTopics'
export const loadTopics = (): string[] => { const t = local.json<unknown>(TOPICS, []); return Array.isArray(t) ? t : [] }
function saveTopics(t: string[]) { local.setJson(TOPICS, t); return t }
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const following = (topics: string[], q: string) => topics.some(t => same(t, q))
export const follow = (q: string) => saveTopics(following(loadTopics(), q) ? loadTopics() : [...loadTopics(), q.trim()].slice(-12))
export const unfollow = (q: string) => saveTopics(loadTopics().filter(t => !same(t, q)))
