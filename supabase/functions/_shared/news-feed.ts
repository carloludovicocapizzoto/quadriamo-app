// Lettura dei feed per il Knowledge Hub: RSS (<item>, anche i podcast) e Atom (<entry>, anche i canali YouTube) in un formato solo.
// Funzioni pure: le usa news-ingest (Deno) e le prova lo script di prova su feed veri (Node).

export interface Raw {
  title: string; link: string; date: string; excerpt: string; words: number
  thumb: string | null      // l'immagine che la fonte mette nel feed (miniatura del video, foto, copertina del podcast)
  seconds: number | null    // durata (podcast e video), se il feed la dà
}
const PER_FEED = 20

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : '' }
const attr = (xml: string, re: RegExp) => xml.match(re)?.[1] ?? ''
// gli attributi possono essere tra virgolette o tra apostrofi (es. i blog di Blogger)
const q = `["']`
// frasi di servizio dei blog che non dicono niente sul contenuto
const boilerplate = (s: string) => s.replace(/\s*The post .{0,200}? appeared first on .{0,120}$/i, '').replace(/\s*(Continue reading|Read more|Leggi tutto|Continua a leggere)\s*(»|→|\.\.\.|…)?\s*$/i, '').trim()
const short = (s: string, n = 280) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n - 1) > 0 ? s.lastIndexOf(' ', n - 1) : n) + '…' : s)

// solo immagini vere e sicure: niente pixel di tracciamento, icone, emoji o avatar
const usable = (u: string) => (/^https:\/\//.test(u) && !/(feedburner|pixel|tracking|gravatar|emoji|\/icons?\/|1x1|spacer|\.gif(\?|$))/i.test(u) ? u : '')
function image(b: string, raw: string): string {
  const img = (re: RegExp) => usable(decode(attr(b, re)))
  return img(new RegExp(`<media:thumbnail[^>]*url=${q}([^"']+)${q}`, 'i'))
    || img(new RegExp(`<media:content[^>]*(?:medium=${q}image${q}|type=${q}image/[^"']+${q})[^>]*url=${q}([^"']+)${q}`, 'i'))
    || img(new RegExp(`<media:content[^>]*url=${q}([^"']+)${q}[^>]*(?:medium=${q}image${q}|type=${q}image/)`, 'i'))
    || img(new RegExp(`<media:content[^>]*url=${q}([^"']+\\.(?:jpe?g|png|webp)(?:\\?[^"']*)?)${q}`, 'i'))
    || img(new RegExp(`<enclosure[^>]*url=${q}([^"']+)${q}[^>]*type=${q}image/`, 'i'))
    || img(new RegExp(`<enclosure[^>]*type=${q}image/[^"']+${q}[^>]*url=${q}([^"']+)${q}`, 'i'))
    || img(new RegExp(`<itunes:image[^>]*href=${q}([^"']+)${q}`, 'i'))
    // la prima immagine dentro la descrizione (blog e testate WordPress)
    || usable(decode(raw.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ?? ''))
}
// "1:02:03", "42:10" o "2530" secondi
function duration(s: string): number | null {
  const p = s.trim().split(':').map(Number)
  if (!p.length || p.some(n => !isFinite(n))) return null
  const sec = p.reduce((a, n) => a * 60 + n, 0)
  return sec > 0 ? sec : null
}

/** RSS (<item>) e Atom (<entry>, anche i canali YouTube) in un formato solo. */
export function parse(xml: string): Raw[] {
  // la copertina del podcast vale per gli episodi senza un'immagine propria (il logo di una testata invece no)
  const head = xml.slice(0, xml.search(/<(item|entry)[\s>]/i) >>> 0)
  const cover = usable(decode(attr(head, new RegExp(`<itunes:image[^>]*href=${q}([^"']+)${q}`, 'i'))))
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map(m => m[0]).slice(0, PER_FEED)
  return blocks.map(b => {
    const link = decode(tag(b, 'link')) || attr(b, new RegExp(`<link[^>]*rel=${q}alternate${q}[^>]*href=${q}([^"']+)${q}`, 'i')) || attr(b, new RegExp(`<link[^>]*href=${q}([^"']+)${q}`, 'i'))
    const body = tag(b, 'content:encoded') || tag(b, 'content')
    // l'audio dell'episodio: se manca la pagina, il link porta all'audio
    const audio = attr(b, new RegExp(`<enclosure[^>]*url=${q}([^"']+)${q}[^>]*type=${q}audio/`, 'i')) || attr(b, new RegExp(`<enclosure[^>]*type=${q}audio/[^"']+${q}[^>]*url=${q}([^"']+)${q}`, 'i'))
    const raw = (tag(b, 'description') || tag(b, 'summary') || body).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    const desc = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'media:description') || body)
    return {
      title: decode(tag(b, 'title')), link: link || decode(audio),
      date: decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated')),
      excerpt: short(boilerplate(desc)), thumb: image(b, raw) || cover || null,
      seconds: duration(decode(tag(b, 'itunes:duration') || attr(b, new RegExp(`<yt:duration[^>]*seconds=${q}(\\d+)${q}`, 'i')))),
      words: body ? decode(body).split(' ').length : 0,
    }
  }).filter(r => r.title && /^https?:\/\//.test(r.link))
}

