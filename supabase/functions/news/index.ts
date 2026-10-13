// Supabase Edge Function "news": i titoli di economia e finanza dalle testate che li pubblicano in RSS.
// Restituisce solo titolo, testata, data e link all'articolo originale (mai il testo): l'app apre l'articolo sul sito della testata.
// Nessun segreto da impostare. "Verify JWT" va spento (la chiama anche chi usa l'app senza account).
const FEEDS: Record<string, { source: string; url: string }[]> = {
  it: [
    { source: 'ANSA', url: 'https://www.ansa.it/sito/notizie/economia/economia_rss.xml' },
    { source: 'Il Sole 24 Ore', url: 'https://www.ilsole24ore.com/rss/finanza.xml' },
    { source: 'Corriere della Sera', url: 'https://www.corriere.it/rss/economia.xml' },
    { source: 'la Repubblica', url: 'https://www.repubblica.it/rss/economia/rss2.0.xml' },
    { source: 'Money.it', url: 'https://www.money.it/spip.php?page=backend' },
  ],
  en: [{ source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' }],
  fr: [{ source: 'Le Monde', url: 'https://www.lemonde.fr/economie/rss_full.xml' }],
  es: [{ source: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/economia.xml' }],
}
// parole che interessano chi gestisce un budget personale: queste notizie vengono segnate "per te"
const TOPICS: Record<string, RegExp> = {
  it: /affitt|bollett|mutu|tass[io]|inflazion|prezz|bce|stipend|salari|bonus|student|universit|risparm|conto corrent|carta|pension|isee|tasse|fisco|benzin|carburant/i,
  en: /rent|bill|mortgage|rate|inflation|price|wage|salary|student|saving|tax|fuel|energy/i,
  fr: /loyer|factur|crédit|taux|inflation|prix|salaire|étudiant|épargne|impôt|carburant|énergie/i,
  es: /alquiler|factura|hipoteca|tipo|inflaci|precio|salario|estudiant|ahorro|impuesto|combustible|energ/i,
}
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }
const cache = new Map<string, { at: number; items: Item[] }>()
interface Item { title: string; link: string; source: string; date: string | null; forYou: boolean }

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : '' }

async function read(feed: { source: string; url: string }, topics: RegExp): Promise<Item[]> {
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': 'QuadriamoNews/1.0 (+https://carloludovicocapizzoto.github.io/quadriamo-app/)' }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return []
    const xml = await res.text()
    return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].slice(0, 25).map(m => {
      const it = m[0], title = tag(it, 'title'), link = tag(it, 'link') || (it.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '')
      const raw = tag(it, 'pubDate') || tag(it, 'dc:date') || tag(it, 'updated')
      const d = raw ? new Date(raw) : null
      return { title, link, source: feed.source, date: d && !isNaN(d.getTime()) ? d.toISOString() : null, forYou: topics.test(title) }
    }).filter(x => x.title && /^https?:\/\//.test(x.link))
  } catch { return [] }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const lang = FEEDS[body.lang] ? body.lang : 'it'
  const hit = cache.get(lang)
  let items = hit && Date.now() - hit.at < 30 * 60e3 ? hit.items : null
  if (!items) {
    const all = (await Promise.all(FEEDS[lang].map(f => read(f, TOPICS[lang])))).flat()
    const seen = new Set<string>()
    const week = Date.now() - 7 * 864e5
    items = all.filter(x => { const k = x.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return !x.date || Date.parse(x.date) > week })
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 40)
    cache.set(lang, { at: Date.now(), items })
  }
  return new Response(JSON.stringify({ lang, items }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' } })
})
