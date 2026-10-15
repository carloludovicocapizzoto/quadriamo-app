// Le sezioni delle Notizie: non un elenco per data, ma poche storie scelte per argomento.
// La stessa notizia da più fonti è una storia sola; nessun contenuto compare in due sezioni.
import { clickbait, score } from '../../supabase/functions/_shared/news-rules'
import type { HubItem } from './hub'
import type { Interests } from './interests'

export interface Story { lead: HubItem; others: HubItem[]; rank: number }
export type SectionId = 'today' | 'mine' | 'personal' | 'invest' | 'research' | 'videos' | 'podcasts' | 'beginner' | 'deep' | 'global'
export interface Section { id: SectionId; stories: Story[] }

const PER_SECTION = 4
const hours = (item: HubItem, now: number) => Math.max(0, (now - Date.parse(item.published)) / 3600e3)
const affinity = (item: HubItem, i: Interests) => {
  const max = Math.max(1, ...Object.values(i))
  const keys = [...item.categories.map(c => `cat:${c}`), `format:${item.format}`, `level:${item.level}`]
  // quanto il contenuto somiglia a ciò che apri, in media sulle sue caratteristiche (0-1)
  return 1 + 0.4 * Math.min(1, keys.reduce((a, k) => a + (i[k] ?? 0), 0) / (keys.length * max))
}

/** Quanto vale un contenuto adesso: fiducia, freschezza, rilevanza, niente esca; poi lingua dell'utente e gusti. */
export function rank(item: HubItem, now: number, lang: string, i: Interests): number {
  // video, podcast e ricerche invecchiano più piano delle notizie
  const base = score({ trust: item.source.trust, ageHours: hours(item, now) / (item.format === 'article' ? 1 : 4), relevance: item.relevance, clickbait: clickbait(item.title) })
  return base * (item.lang === lang ? 1.15 : 1) * affinity(item, i)
}

/** Raggruppa per evento: la storia la guida il contenuto migliore, le altre fonti sono "prospettive". */
export function stories(items: HubItem[], now: number, lang: string, i: Interests): Story[] {
  const by = new Map<string, HubItem[]>()
  for (const it of items) { const k = it.cluster ?? it.id; by.set(k, [...(by.get(k) ?? []), it]) }
  return [...by.values()].map(group => {
    const sorted = group.map(it => ({ it, r: rank(it, now, lang, i) })).sort((a, b) => b.r - a.r)
    // più fonti indipendenti sulla stessa notizia: conta di più
    return { lead: sorted[0].it, others: sorted.slice(1).map(x => x.it), rank: sorted[0].r * (1 + 0.15 * Math.min(3, sorted.length - 1)) }
  }).sort((a, b) => b.rank - a.rank)
}

// testo senza maiuscole né accenti: "Mutuo" trova "mutui", "economia" trova "economía"
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Il contenuto parla di `query`? Ogni parola deve esserci, anche come inizio di parola (mutu → mutuo, mutui). */
export function matches(item: HubItem, query: string): boolean {
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  const text = plain(`${item.title} ${item.excerpt ?? ''} ${item.source.name}`)
  return words.every(w => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}`, 'u').test(text))
}

const PERSONAL = ['personal', 'saving', 'budget', 'pension', 'tax', 'realestate']
const INVEST = ['etf', 'stocks', 'bonds', 'markets']
const GLOBAL = ['economy', 'commodities']
const has = (s: Story, cats: string[]) => s.lead.categories.some(c => cats.includes(c))
// chi sceglie per primo: le sezioni per formato (ricerche, video) prima di quelle per argomento,
// così un video sugli ETF sta tra i video e non sparisce tra gli articoli
// "i tuoi argomenti" sceglie per prima (sono le parole che hai scelto di seguire), ma si legge dopo Oggi
const RULES: { id: SectionId; take: (s: Story, now: number, topics: string[]) => boolean }[] = [
  { id: 'mine', take: (s, _now, topics) => topics.some(t => matches(s.lead, t)) },
  { id: 'today', take: (s, now) => s.lead.format === 'article' && hours(s.lead, now) <= 36 },
  { id: 'research', take: s => s.lead.format === 'research' },
  { id: 'videos', take: s => s.lead.format === 'video' },
  { id: 'podcasts', take: s => s.lead.format === 'podcast' },
  { id: 'beginner', take: s => s.lead.level === 'beginner' },
  { id: 'deep', take: s => s.lead.source.kind === 'independent' },
  { id: 'personal', take: s => has(s, PERSONAL) },
  { id: 'invest', take: s => has(s, INVEST) },
  { id: 'global', take: s => has(s, GLOBAL) },
]
// in che ordine si leggono
const SHOWN: SectionId[] = ['today', 'mine', 'personal', 'invest', 'research', 'videos', 'podcasts', 'beginner', 'deep', 'global']

/** Le sezioni, in ordine, senza cripto (hanno la loro scheda) e senza ripetizioni. */
export function buildSections(items: HubItem[], now: number, lang: string, i: Interests, topics: string[] = []): Section[] {
  const all = stories(items.filter(x => !x.crypto), now, lang, i)
  const used = new Set<string>()
  return RULES.map(r => {
    const picked = all.filter(s => !used.has(s.lead.id) && r.take(s, now, topics)).slice(0, PER_SECTION)
    picked.forEach(s => used.add(s.lead.id))
    return { id: r.id, stories: picked }
  }).filter(s => s.stories.length).sort((a, b) => SHOWN.indexOf(a.id) - SHOWN.indexOf(b.id))
}

/** Ricerca e filtri attivi: le storie in ordine di valore, o dalla più recente. I filtri li applica news/filters. */
export function find(items: HubItem[], query: string, now: number, lang: string, i: Interests, sort: 'relevant' | 'recent' = 'relevant'): Story[] {
  const list = stories(items.filter(x => !query.trim() || matches(x, query)), now, lang, i)
  if (sort === 'recent') list.sort((a, b) => Date.parse(b.lead.published) - Date.parse(a.lead.published))
  return list.slice(0, 40)
}
