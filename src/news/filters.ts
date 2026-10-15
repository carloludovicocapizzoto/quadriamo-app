// Filtri delle Notizie: tipo, argomento, lingua, area, fonte e ordinamento. Restano salvati sul telefono.
// Nessun filtro = tutti i contenuti nella propria lingua e in inglese, nelle sezioni scelte dall'app.
import type { Format, HubItem } from './hub'

export type SourceGroup = 'press' | 'independent' | 'research' | 'video' | 'podcast'
export type Sort = 'relevant' | 'recent'
export interface NewsFilter { types: Format[]; topics: string[]; langs: string[]; areas: string[]; sources: SourceGroup[]; sort: Sort }

export const TYPES: Format[] = ['article', 'video', 'podcast', 'research']
export const TOPICS = ['personal', 'saving', 'budget', 'etf', 'stocks', 'bonds', 'markets', 'economy', 'realestate', 'pension', 'tax',
  'psychology', 'commodities', 'tech', 'ai', 'startup', 'crypto']
export const LANGS = ['it', 'en', 'fr', 'es']
export const AREAS = ['IT', 'EU', 'US', 'GB', 'FR', 'ES', 'CA', 'CH']
export const SOURCES: SourceGroup[] = ['press', 'independent', 'research', 'video', 'podcast']
export const EMPTY: NewsFilter = { types: [], topics: [], langs: [], areas: [], sources: [], sort: 'relevant' }

const KEY = 'q.newsFilter'
export function loadFilter(): NewsFilter {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return EMPTY }
}
export function saveFilter(f: NewsFilter) { try { localStorage.setItem(KEY, JSON.stringify(f)) } catch { /* niente */ } }

/** Quanti filtri sono attivi (l'ordinamento conta se non è quello di partenza). */
export const activeCount = (f: NewsFilter) =>
  f.types.length + f.topics.length + f.langs.length + f.areas.length + f.sources.length + (f.sort !== 'relevant' ? 1 : 0)

const group = (kind: string): SourceGroup => kind === 'institution' ? 'research' : kind as SourceGroup

/** I contenuti che passano i filtri. Lingua non scelta: la propria e l'inglese. Le cripto solo se scelte come argomento. */
export function applyFilter(items: HubItem[], f: NewsFilter, lang: string): HubItem[] {
  const langs = f.langs.length ? f.langs : [lang, 'en']
  return items.filter(x =>
    langs.includes(x.lang)
    && (!f.types.length || f.types.includes(x.format))
    && (!f.topics.length || f.topics.some(t => t === 'crypto' ? x.crypto : x.categories.includes(t)))
    && (!x.crypto || f.topics.includes('crypto'))
    && (!f.areas.length || f.areas.includes(x.source.country ?? ''))
    && (!f.sources.length || f.sources.includes(group(x.source.kind))))
}
