// Notizie di economia e finanza (funzione "news" su Supabase): titolo, testata, data e link. Tenute 20 minuti sul dispositivo.
import { supabase } from '../sync/client'

export interface NewsItem { title: string; link: string; source: string; date: string | null; forYou: boolean }
const KEY = 'q.news'

export async function loadNews(lang: string): Promise<NewsItem[] | null> {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { lang: string; at: number; items: NewsItem[] } | null
    if (c && c.lang === lang && Date.now() - c.at < 20 * 60e3) return c.items
  } catch { /* niente */ }
  if (!supabase || !navigator.onLine) return null
  try {
    const { data, error } = await supabase.functions.invoke('news', { body: { lang } })
    if (error || !Array.isArray(data?.items)) return null
    try { localStorage.setItem(KEY, JSON.stringify({ lang, at: Date.now(), items: data.items })) } catch { /* niente */ }
    return data.items as NewsItem[]
  } catch { return null }
}
