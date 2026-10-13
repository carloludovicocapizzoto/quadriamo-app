// Knowledge Hub: i contenuti raccolti dal server (tabella news_items, sola lettura) con la loro fonte.
// Tenuti 20 minuti sul telefono, e anche offline. Se la raccolta non è ancora attiva, null: la schermata usa i titoli di prima.
import { supabase } from '../sync/client'

export type Format = 'article' | 'research' | 'video'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export interface HubItem {
  id: string; title: string; excerpt: string | null; link: string; thumb: string | null; published: string; lang: string
  format: Format; categories: string[]; level: Level; minutes: number | null; relevance: number; cluster: string | null; crypto: boolean
  source: { name: string; kind: string; paywall: boolean; trust: number }
}
const KEY = 'q.hub'
const FRESH_MS = 20 * 60e3

export async function loadHub(lang: string, force = false): Promise<HubItem[] | null> {
  let cached: { lang: string; at: number; items: HubItem[] } | null = null
  try { cached = JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { /* niente */ }
  if (!force && cached?.lang === lang && Date.now() - cached.at < FRESH_MS) return cached.items
  if (!supabase || !navigator.onLine) return cached?.lang === lang ? cached.items : null
  try {
    // la propria lingua e l'inglese (ricerca e fonti internazionali), ultimi 45 giorni
    const since = new Date(Date.now() - 45 * 864e5).toISOString()
    const { data, error } = await supabase.from('news_items')
      .select('id, title, excerpt, link, thumb, published, lang, format, categories, level, minutes, relevance, cluster, crypto, source:news_sources(name, kind, paywall, trust)')
      .gte('published', since).in('lang', lang === 'en' ? ['en'] : [lang, 'en']).order('published', { ascending: false }).limit(600)
    if (error || !data?.length) return cached?.lang === lang ? cached.items : null
    const items = data as unknown as HubItem[]
    try { localStorage.setItem(KEY, JSON.stringify({ lang, at: Date.now(), items })) } catch { /* niente */ }
    return items
  } catch { return cached?.lang === lang ? cached.items : null }
}
