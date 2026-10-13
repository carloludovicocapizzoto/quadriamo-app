// Prova della raccolta del Knowledge Hub su feed veri, senza database: legge le fonti dallo script 0018,
// scarica e classifica come news-ingest e stampa cosa entrerebbe. Uso: node tools/news/dry-run.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '../../supabase/functions/_shared/news-feed.ts'
import { SAME_EVENT, canonical, categorize, cleanTitle, clickbait, isJunk, keywords, level, relevance, similarity } from '../../supabase/functions/_shared/news-rules.ts'
// con --sample scrive tools/news/sample.json: contenuti veri nel formato dell'app, per le schermate senza database

const sql = readFileSync(new URL('../../supabase/migrations/0018_news_hub.sql', import.meta.url), 'utf8')
const rows = [...sql.matchAll(/\('([^']+)', '((?:[^']|'')+)', '(\w+)', '(\w+)', '([^']+)', '[^']*', '(\w+)', '\w*', (\d), (true|false), array\['(\w+)'\]\)/g)]
const sources = rows.map(m => ({ id: m[1], name: m[2].replace(/''/g, "'"), kind: m[3], format: m[4], feed: m[5], lang: m[6], trust: +m[7], topics: [m[9]] }))
const now = Date.now()
const counts: Record<string, number> = {}, levels: Record<string, number> = {}
const pool: { source: string; words: string[]; title: string; cluster: string }[] = []
const sample: Record<string, unknown>[] = []
let kept = 0, junk = 0, bait = 0, old = 0, clusters = 0
const fails: string[] = []
for (const s of sources) {
  const url = s.format === 'youtube' ? `https://www.youtube.com/feeds/videos.xml?channel_id=${s.feed}` : s.feed
  let raw
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuadriamoNews/1.0)' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) { fails.push(`${s.id} HTTP ${r.status}`); continue }
    raw = parse(await r.text())
  } catch (e) { fails.push(`${s.id} ${(e as Error).message}`); continue }
  let n = 0
  for (const x0 of raw) {
    const x = { ...x0, title: cleanTitle(x0.title) }
    const t = x.date ? new Date(x.date).getTime() : now
    if (isNaN(t) || now - t > ({ press: 7, independent: 14, video: 21, research: 45, institution: 45 } as Record<string, number>)[s.kind] * 864e5) { if (x.date) { old++; continue } }
    if (isJunk(x.title)) { junk++; continue }
    if (clickbait(x.title) >= 0.9) { bait++; continue }
    const text = `${x.title} ${x.excerpt}`
    const cats = categorize(text, s.topics)
    for (const c of cats) counts[c] = (counts[c] ?? 0) + 1
    const lv = level(text, s.kind); levels[lv] = (levels[lv] ?? 0) + 1
    const words = keywords(x.title)
    const twin = pool.find(p => p.source !== s.id && similarity(words, p.words) >= SAME_EVENT)
    if (twin) { clusters++; if (clusters <= 6) console.log(`  stessa notizia: «${twin.title}» ≈ «${x.title}»`) }
    const id = canonical(x.link)
    pool.push({ source: s.id, words, title: x.title, cluster: twin?.cluster ?? id })
    const format = s.format === 'youtube' ? 'video' : s.kind === 'research' || s.kind === 'institution' ? 'research' : 'article'
    sample.push({ id, title: x.title, excerpt: x.excerpt || null, link: x.link, thumb: format === 'video' ? x.thumb : null, published: new Date(t).toISOString(),
      lang: s.lang, format, categories: cats.filter(c => c !== 'crypto'), level: lv, minutes: format === 'research' ? 15 : null, relevance: relevance(cats, s.kind === 'research' || s.kind === 'institution' ? categorize(text).length > 0 : true),
      cluster: twin?.cluster ?? id, crypto: cats.includes('crypto'), source: { name: s.name, kind: s.kind, paywall: /true/.test(String(rows.find(r => r[1] === s.id)?.[8])), trust: s.trust } })
    n++; kept++
  }
  console.log(`${s.id.padEnd(22)} ${String(raw.length).padStart(3)} letti, ${String(n).padStart(3)} entrano`)
}
console.log({ kept, old, junk, bait, clusters, fails })
console.log('categorie', counts)
console.log('livelli', levels)

if (process.argv.includes('--sample')) writeFileSync(new URL('./sample.json', import.meta.url), JSON.stringify(sample))
