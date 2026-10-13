// Supabase Edge Function "news-ingest": ogni 2 ore (pg_cron, serve CRON_SECRET) legge i feed delle fonti approvate
// (tabella news_sources), toglie doppioni e titoli senza sostanza, classifica con regole, riconosce la stessa notizia
// raccontata da più fonti e salva in news_items solo titolo, estratto del feed, link, data e (per i video) miniatura.
// Toglie i contenuti più vecchi di 30 giorni. Vedi docs/NEWS-HUB.md.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SAME_EVENT, canonical, categorize, cleanTitle, clickbait, isJunk, keywords, level, relevance, score, similarity } from '../_shared/news-rules.ts'
import { parse, type Raw } from '../_shared/news-feed.ts'

interface Source { id: string; name: string; kind: string; format: string; feed: string; lang: string; trust: number; topics: string[] }

const env = (k: string) => (Deno.env.get(k) ?? '').trim()
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
// quanto può essere vecchio un contenuto per entrare: le ricerche escono di rado, le testate ogni ora
const MAX_AGE_DAYS: Record<string, number> = { press: 7, independent: 14, video: 21, research: 45, institution: 45 }
const KEEP_DAYS = 60

async function sha(s: string) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

async function read(src: Source): Promise<{ src: Source; raw: Raw[]; error?: string }> {
  const url = src.format === 'youtube' ? `https://www.youtube.com/feeds/videos.xml?channel_id=${src.feed}` : src.feed
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuadriamoNews/1.0; +https://carloludovicocapizzoto.github.io/quadriamo-app/)' },
      signal: AbortSignal.timeout(9000) })
    if (!res.ok) return { src, raw: [], error: `HTTP ${res.status}` }
    return { src, raw: parse(await res.text()) }
  } catch (e) { return { src, raw: [], error: (e as Error).message.slice(0, 120) } }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!env('CRON_SECRET') || (req.headers.get('x-cron-secret') ?? '').trim() !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403)
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  const { data: sources, error } = await db.from('news_sources').select('id, name, kind, format, feed, lang, trust, topics').eq('active', true)
  if (error) return json({ error: error.message }, 500)
  // contenuti delle ultime 48 ore: servono a riconoscere la stessa notizia arrivata prima da un'altra fonte
  const since = new Date(Date.now() - 48 * 3600e3).toISOString()
  const { data: recent } = await db.from('news_items').select('id, source_id, title, cluster').gte('published', since)
  const pool = (recent ?? []).map(r => ({ id: r.id as string, source: r.source_id as string, words: keywords(r.title as string), cluster: (r.cluster as string) || (r.id as string) }))

  const now = Date.now()
  const results: { src: Source; raw: Raw[]; error?: string }[] = []
  const list = (sources ?? []) as Source[]
  for (let i = 0; i < list.length; i += 8) results.push(...await Promise.all(list.slice(i, i + 8).map(read)))

  const rows: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const { src, raw } of results) {
    for (const r0 of raw) {
      const r = { ...r0, title: cleanTitle(r0.title) }
      // senza data (es. NBER) vale il momento in cui lo vediamo la prima volta: dopo non si riscrive più
      const when = r.date ? new Date(r.date) : new Date(now)
      if (isNaN(when.getTime()) || now - when.getTime() > (MAX_AGE_DAYS[src.kind] ?? 7) * 864e5 || when.getTime() > now + 3600e3) continue
      if (isJunk(r.title)) continue
      const bait = clickbait(r.title)
      if (bait >= 0.9) continue
      const link = canonical(r.link)
      const id = await sha(link)
      if (seen.has(id)) continue
      seen.add(id)
      const text = `${r.title} ${r.excerpt}`
      const cats = categorize(text, src.topics)
      // per ricerca e istituzioni conta se il testo parla davvero di finanza, non la categoria tipica della fonte
      const rel = relevance(cats, src.kind === 'research' || src.kind === 'institution' ? categorize(text).length > 0 : true)
      const words = keywords(r.title)
      // stessa notizia: titolo simile, fonte diversa, ultime 48 ore
      const twin = pool.find(p => p.source !== src.id && similarity(words, p.words) >= SAME_EVENT)
      const cluster = twin?.cluster ?? id
      pool.push({ id, source: src.id, words, cluster })
      const format = src.format === 'youtube' ? 'video' : src.kind === 'research' || src.kind === 'institution' ? 'research' : 'article'
      rows.push({
        id, source_id: src.id, title: r.title, excerpt: r.excerpt || null, link, thumb: format === 'video' ? r.thumb : null,
        published: when.toISOString(), lang: src.lang, format,
        categories: cats.filter(c => c !== 'crypto'), crypto: cats.includes('crypto'), level: level(text, src.kind),
        minutes: r.words > 150 ? Math.min(30, Math.max(2, Math.round(r.words / 220))) : format === 'research' ? 15 : null,
        relevance: rel, score: score({ trust: src.trust, ageHours: (now - when.getTime()) / 3600e3, relevance: rel, clickbait: bait }), cluster,
      })
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    // solo i contenuti nuovi: quelli già salvati restano com'erano (data compresa)
    const { error: e } = await db.from('news_items').upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
    if (e) return json({ error: e.message }, 500)
  }
  await db.from('news_items').delete().lt('published', new Date(now - KEEP_DAYS * 864e5).toISOString())
  // salute delle fonti: l'area admin mostra quali feed non rispondono
  for (const { src, raw, error: e } of results) {
    await db.from('news_sources').update(e ? { last_error: e } : { last_ok: new Date().toISOString(), last_count: raw.length, last_error: null }).eq('id', src.id)
  }
  return json({ sources: results.length, failed: results.filter(r => r.error).map(r => `${r.src.id}: ${r.error}`), saved: rows.length })
})
