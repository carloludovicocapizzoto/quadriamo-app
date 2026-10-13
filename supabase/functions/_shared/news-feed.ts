// Lettura dei feed per il Knowledge Hub: RSS (<item>) e Atom (<entry>, anche i canali YouTube) in un formato solo.
// Funzioni pure: le usa news-ingest (Deno) e le prova lo script di prova su feed veri (Node).

export interface Raw { title: string; link: string; date: string; excerpt: string; thumb: string | null; words: number }
const PER_FEED = 20

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : '' }
const attr = (xml: string, re: RegExp) => xml.match(re)?.[1] ?? ''
// gli attributi possono essere tra virgolette o tra apostrofi (es. i blog di Blogger)
const q = `["']`
// frasi di servizio dei blog che non dicono niente sul contenuto
const boilerplate = (s: string) => s.replace(/\s*The post .{0,200}? appeared first on .{0,120}$/i, '').replace(/\s*(Continue reading|Read more|Leggi tutto|Continua a leggere)\s*(»|→|\.\.\.|…)?\s*$/i, '').trim()
const short = (s: string, n = 280) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n - 1) > 0 ? s.lastIndexOf(' ', n - 1) : n) + '…' : s)

/** RSS (<item>) e Atom (<entry>, anche i canali YouTube) in un formato solo. */
export function parse(xml: string): Raw[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map(m => m[0]).slice(0, PER_FEED)
  return blocks.map(b => {
    const link = decode(tag(b, 'link')) || attr(b, new RegExp(`<link[^>]*rel=${q}alternate${q}[^>]*href=${q}([^"']+)${q}`, 'i')) || attr(b, new RegExp(`<link[^>]*href=${q}([^"']+)${q}`, 'i'))
    const body = tag(b, 'content:encoded') || tag(b, 'content')
    const desc = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'media:description') || body)
    return {
      title: decode(tag(b, 'title')), link,
      date: decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated')),
      excerpt: short(boilerplate(desc)), thumb: attr(b, new RegExp(`<media:thumbnail[^>]*url=${q}([^"']+)${q}`, 'i')) || null,
      words: body ? decode(body).split(' ').length : 0,
    }
  }).filter(r => r.title && /^https?:\/\//.test(r.link))
}

