// Prova della raccolta del Knowledge Hub su feed veri, senza database: legge le fonti dagli script 0018 e 0020,
// scarica e classifica con la stessa funzione di news-ingest e stampa cosa entrerebbe. Uso: node tools/news/dry-run.ts
// con --sample scrive tools/news/sample.json: contenuti veri nel formato dell'app, per le schermate senza database
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '../../supabase/functions/_shared/news-feed.ts'
import { canonical } from '../../supabase/functions/_shared/news-rules.ts'
import { toItem, type Recent, type Source } from '../../supabase/functions/_shared/news-item.ts'

const sql = ['0018_news_hub.sql', '0020_news_podcasts_images.sql'].map(f => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')).join('\n')
const rows = [...sql.matchAll(/\('([^']+)', '((?:[^']|'')+)', '(\w+)', '(\w+)', '([^']+)', '[^']*', '(\w+)', '\w*', (\d), (true|false), array\['(\w+)'\]\)/g)]
const sources: (Source & { paywall: boolean })[] = rows.map(m => ({ id: m[1], name: m[2].replace(/''/g, "'"), kind: m[3], format: m[4], feed: m[5], lang: m[6],
  trust: +m[7], paywall: m[8] === 'true', topics: [m[9]], images: true }))
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7)
const now = Date.now()
const counts: Record<string, number> = {}, levels: Record<string, number> = {}, skipped: Record<string, number> = {}
const pool: Recent[] = []
const sample: Record<string, unknown>[] = []
let kept = 0, pics = 0
const fails: string[] = []
for (const s of sources.filter(x => !only || x.id.startsWith(only))) {
  const url = s.format === 'youtube' ? `https://www.youtube.com/feeds/videos.xml?channel_id=${s.feed}` : s.feed
  let raw
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuadriamoNews/1.0)' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) { fails.push(`${s.id} HTTP ${r.status}`); continue }
    raw = parse(await r.text())
  } catch (e) { fails.push(`${s.id} ${(e as Error).message}`); continue }
  let n = 0, img = 0
  for (const x of raw) {
    const out = toItem(s, x, canonical(x.link), now, pool)
    if ('skip' in out) { skipped[out.skip] = (skipped[out.skip] ?? 0) + 1; continue }
    const r = out.row as { categories: string[]; level: string; thumb: string | null }
    for (const c of r.categories) counts[c] = (counts[c] ?? 0) + 1
    levels[r.level] = (levels[r.level] ?? 0) + 1
    if (r.thumb) img++
    sample.push({ ...r, source: { name: s.name, kind: s.kind, paywall: s.paywall, trust: s.trust } })
    n++; kept++
  }
  pics += img
  console.log(`${s.id.padEnd(22)} ${String(raw.length).padStart(3)} letti, ${String(n).padStart(3)} entrano, ${String(img).padStart(3)} con immagine`)
}
console.log({ kept, pics, skipped, clusters: new Set(sample.map(x => x.cluster)).size, fails })
console.log('categorie', counts)
console.log('livelli', levels)

if (process.argv.includes('--sample')) writeFileSync(new URL('./sample.json', import.meta.url), JSON.stringify(sample))
