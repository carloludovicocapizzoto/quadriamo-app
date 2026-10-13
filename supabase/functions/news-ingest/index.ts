// Supabase Edge Function "news-ingest": ogni 2 ore (pg_cron, serve CRON_SECRET) legge i feed delle fonti approvate
// (tabella news_sources), toglie doppioni e titoli senza sostanza, classifica con regole, riconosce la stessa notizia
// raccontata da più fonti e salva in news_items solo titolo, estratto del feed, link, data e l'indirizzo dell'immagine del feed.
// Toglie i contenuti più vecchi di 60 giorni. Vedi docs/NEWS-HUB.md.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parse, type Raw } from '../_shared/news-feed.ts'
import { canonical, keywords } from '../_shared/news-rules.ts'
import { toItem, type Recent, type Source } from '../_shared/news-item.ts'

const env = (k: string) => (Deno.env.get(k) ?? '').trim()
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
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

  const { data: sources, error } = await db.from('news_sources').select('*').eq('active', true)
  if (error) return json({ error: error.message }, 500)
  // contenuti delle ultime 48 ore: servono a riconoscere la stessa notizia arrivata prima da un'altra fonte
  const since = new Date(Date.now() - 48 * 3600e3).toISOString()
  const { data: recent } = await db.from('news_items').select('id, source_id, title, cluster').gte('published', since)
  const pool: Recent[] = (recent ?? []).map(r => ({ id: r.id as string, source: r.source_id as string, words: keywords(r.title as string), cluster: (r.cluster as string) || (r.id as string) }))

  const now = Date.now()
  const results: { src: Source; raw: Raw[]; error?: string }[] = []
  const list = (sources ?? []) as Source[]
  for (let i = 0; i < list.length; i += 8) results.push(...await Promise.all(list.slice(i, i + 8).map(read)))

  const rows: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const { src, raw } of results) {
    for (const r of raw) {
      const id = await sha(canonical(r.link))
      if (seen.has(id)) continue
      seen.add(id)
      const out = toItem(src, r, id, now, pool)
      if ('row' in out) rows.push(out.row)
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
