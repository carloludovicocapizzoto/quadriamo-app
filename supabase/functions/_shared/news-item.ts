// Da un contenuto letto dal feed a una riga di news_items: cosa entra, con quali categorie, livello, immagine e punteggio.
// Una funzione sola per news-ingest (Deno) e per lo script di prova su feed veri (Node), così fanno la stessa cosa.
import type { Raw } from './news-feed.ts'
import { SAME_EVENT, canonical, categorize, cleanTitle, clickbait, isJunk, keywords, level, relevance, score, similarity } from './news-rules.ts'

export interface Source { id: string; name: string; kind: string; format: string; feed: string; lang: string; trust: number; topics: string[]; images: boolean }
/** Contenuti delle ultime 48 ore: servono a riconoscere la stessa notizia arrivata prima da un'altra fonte. */
export interface Recent { id: string; source: string; words: string[]; cluster: string }

// quanto può essere vecchio un contenuto per entrare: le ricerche escono di rado, le testate ogni ora
export const MAX_AGE_DAYS: Record<string, number> = { press: 7, independent: 14, video: 21, podcast: 30, research: 45, institution: 45 }

export const formatOf = (src: Source) =>
  src.format === 'youtube' ? 'video' : src.kind === 'podcast' ? 'podcast' : src.kind === 'research' || src.kind === 'institution' ? 'research' : 'article'

/** La riga da salvare, o il motivo per cui il contenuto resta fuori. `pool` si aggiorna: serve al contenuto seguente. */
export function toItem(src: Source, r0: Raw, id: string, now: number, pool: Recent[]):
  { row: Record<string, unknown> } | { skip: 'old' | 'junk' | 'bait' } {
  const r = { ...r0, title: cleanTitle(r0.title) }
  // senza data (es. NBER) vale il momento in cui lo vediamo la prima volta: dopo non si riscrive più
  const when = r.date ? new Date(r.date) : new Date(now)
  if (isNaN(when.getTime()) || now - when.getTime() > (MAX_AGE_DAYS[src.kind] ?? 7) * 864e5 || when.getTime() > now + 3600e3) return { skip: 'old' }
  if (isJunk(r.title)) return { skip: 'junk' }
  const bait = clickbait(r.title)
  if (bait >= 0.9) return { skip: 'bait' }
  const text = `${r.title} ${r.excerpt}`
  const cats = categorize(text, src.topics)
  // per ricerca e istituzioni conta se il testo parla davvero di finanza, non la categoria tipica della fonte
  const rel = relevance(cats, src.kind === 'research' || src.kind === 'institution' ? categorize(text).length > 0 : true)
  const words = keywords(r.title)
  // stessa notizia: titolo simile, fonte diversa, ultime 48 ore (i podcast restano a sé)
  const format = formatOf(src)
  const twin = format === 'podcast' ? undefined : pool.find(p => p.source !== src.id && similarity(words, p.words) >= SAME_EVENT)
  const cluster = twin?.cluster ?? id
  pool.push({ id, source: src.id, words, cluster })
  // durata: dal feed per podcast e video; per gli articoli dalle parole del testo, se il feed lo pubblica
  const minutes = r.seconds ? Math.max(1, Math.round(r.seconds / 60))
    : r.words > 150 ? Math.min(30, Math.max(2, Math.round(r.words / 220))) : format === 'research' ? 15 : null
  return {
    row: {
      id, source_id: src.id, title: r.title, excerpt: r.excerpt || null, link: canonical(r.link),
      // l'immagine che la fonte mette nel feed, caricata dal suo sito: mai salvata da noi. Si spegne per fonte (images)
      thumb: format === 'video' || format === 'podcast' || src.images !== false ? r.thumb : null,
      published: when.toISOString(), lang: src.lang, format,
      categories: cats.filter(c => c !== 'crypto'), crypto: cats.includes('crypto'), level: level(text, src.kind),
      minutes, relevance: rel, score: score({ trust: src.trust, ageHours: (now - when.getTime()) / 3600e3, relevance: rel, clickbait: bait }), cluster,
    },
  }
}
