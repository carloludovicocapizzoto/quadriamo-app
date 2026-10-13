import { useEffect, useMemo, useState } from 'react'
import { tips, type Tip } from '../../content/tips'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { loadNews, type NewsItem } from '../../news/api'
import { loadHub, type HubItem } from '../../news/hub'
import { follow, following, loadInterests, loadTopics, remember, unfollow } from '../../news/interests'
import { buildSections, find, type Story } from '../../news/sections'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'

// i filtri in alto: i formati, poi gli argomenti più cercati; le cripto in fondo, separate
const FILTERS = ['podcast', 'video', 'personal', 'etf', 'stocks', 'economy', 'markets', 'realestate', 'pension', 'tax', 'saving', 'psychology', 'bonds', 'commodities', 'ai', 'tech', 'startup', 'crypto']

/**
 * Notizie: poche storie scelte ogni giorno, per argomento, da fonti approvate (testate, indipendenti, ricerca, video, podcast).
 * Si legge (o si ascolta) sul sito originale: qui titolo, fonte, l'estratto e l'immagine che la fonte pubblica nel feed.
 * In alto la ricerca per parole: un argomento cercato si può seguire e diventa la sezione «I tuoi argomenti».
 * Finché la raccolta non è attiva sul server, i titoli delle testate di prima.
 */
export function NewsScreen({ onAction }: { onAction: (a: NonNullable<Tip['action']>) => void }) {
  const { t, lang } = useI18n()
  const [hub, setHub] = useState<HubItem[] | null | undefined>(undefined)
  const [legacy, setLegacy] = useState<NewsItem[] | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Story | null>(null)
  const [now, setNow] = useState(0)
  const [tick, setTick] = useState(0)
  const [interests, setInterests] = useState(loadInterests)
  const [query, setQuery] = useState('')
  const [topics, setTopics] = useState(loadTopics)

  useEffect(() => {
    let alive = true
    void loadHub(lang, tick > 0).then(async h => {
      if (!alive) return
      setNow(Date.now()); setHub(h)
      if (!h) { const old = await loadNews(lang); if (alive) setLegacy(old) }
    })
    return () => { alive = false }
  }, [lang, tick])

  const q = query.trim()
  const narrowed = !!filter || q.length > 1
  const sections = useMemo(() => (hub && now ? buildSections(hub, now, lang, interests, topics) : []), [hub, now, lang, interests, topics])
  const found = useMemo(() => (hub && now && narrowed ? find(hub, filter, q.length > 1 ? q : '', now, lang, interests) : []), [hub, now, narrowed, filter, q, lang, interests])
  const followed = following(topics, q)
  const read = (s: Story) => { tap(); remember(s.lead); setInterests(loadInterests()); setOpen(s) }

  return (
    <div className="screen news2">
      <div className="sec-head"><h1 className="screen-title">{t('nav.news')}</h1>
        <button className="icon-btn ghost" onClick={() => { tap(); setHub(undefined); setTick(x => x + 1) }} aria-label={t('news.refresh')}><Icon name="refresh" size={20} /></button></div>

      {hub && <label className="news-search"><Icon name="search" size={18} />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('news.search')} aria-label={t('news.search')} enterKeyHint="search" />
      </label>}

      {hub && <div className="news-filters" role="tablist">
        <button role="tab" aria-selected={!filter} className={!filter ? 'on' : ''} onClick={() => { tap(); setFilter(null) }}>{t('news.all')}</button>
        {FILTERS.map(f => <button key={f} role="tab" aria-selected={filter === f} className={`${filter === f ? 'on' : ''}${f === 'crypto' ? ' apart' : ''}`}
          onClick={() => { tap(); setFilter(f); window.scrollTo(0, 0) }}>{t(`cat.${f}` as keyof Dict)}</button>)}
      </div>}

      {hub === undefined ? <div className="news-loading">{[0, 1, 2, 3].map(i => <div key={i} className="skel"><span /><span /></div>)}</div>
        : hub ? (narrowed
          ? <>
              {q.length > 1 && <button className="link-btn news-follow" onClick={() => { tap(); setTopics(followed ? unfollow(q) : follow(q)) }}>
                {t(followed ? 'news.unfollow' : 'news.follow', { q })}</button>}
              {found.length ? <StoryList stories={found} now={now} onOpen={read} /> : <p className="muted news-empty">{t(q.length > 1 ? 'news.noMatch' : 'news.empty')}</p>}
            </>
          : sections.map(s => <section key={s.id} className="news-section">
              <h2 className="sec-title">{t(`news.sec.${s.id}` as keyof Dict)}</h2>
              {s.id === 'mine' && <p className="news-topics">{topics.map(x => <button key={x} className="link-btn" onClick={() => { tap(); setQuery(x); window.scrollTo(0, 0) }}>{x}</button>)}</p>}
              <StoryList stories={s.stories} now={now} onOpen={read} lead={s.id === 'today'} />
            </section>))
        : <Legacy items={legacy} now={now} />}

      {!narrowed && <section className="news-section">
        <h2 className="sec-title">{t('news.sec.tips')}</h2>
        <ul className="group-list faq">{tips(lang).map(x => (
          <li key={x.id}><details><summary className="row"><span className="row-main">{x.title}</span><Icon name="chevron" size={18} className="row-chev" /></summary>
            <p>{x.text}</p>
            {x.action && <button className="link-btn tip-act" onClick={() => { tap(); onAction(x.action!) }}>{t(`disc.act.${x.action}` as keyof Dict)}<Icon name="chevron" size={15} /></button>}
          </details></li>))}</ul>
      </section>}

      <p className="group-foot news-note">{t('news.note')}</p>

      <Sheet open={!!open} onClose={() => setOpen(null)}>{open && <StoryDetail story={open} now={now} />}</Sheet>
    </div>
  )
}

function useAgo(now: number) {
  const { lang } = useI18n()
  return (d: string) => {
    if (!now) return ''
    const m = Math.round((now - Date.parse(d)) / 60000), rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    return m < 60 ? rtf.format(-Math.max(1, m), 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day')
  }
}

/** Fonte · quando · livello · minuti · a pagamento · altre fonti: tutto quello che serve per decidere se aprirla. */
function Meta({ s, now }: { s: Story; now: number }) {
  const { t } = useI18n()
  const ago = useAgo(now)
  const it = s.lead
  const bits = [it.source.name, ago(it.published),
    it.level !== 'intermediate' ? t(`news.lvl.${it.level}` as keyof Dict) : null,
    it.minutes ? t('news.min', { n: it.minutes }) : null,
    it.source.paywall ? t('news.paywall') : null,
    s.others.length ? t('news.more', { n: s.others.length }) : null].filter(Boolean)
  return <span className="story-meta">{bits.join(' · ')}</span>
}

function StoryList({ stories, now, onOpen, lead = false }: { stories: Story[]; now: number; onOpen: (s: Story) => void; lead?: boolean }) {
  return (
    <ul className={`stories${lead ? ' lead' : ''}`}>
      {stories.map(s => (
        <li key={s.lead.id}><button className="story" onClick={() => onOpen(s)}>
          <span className="story-text"><span className="story-title">{s.lead.title}</span><Meta s={s} now={now} /></span>
          {s.lead.thumb && <Thumb src={s.lead.thumb} className={`story-thumb ${s.lead.format}`} />}
        </button></li>
      ))}
    </ul>
  )
}

/** L'immagine che la fonte mette nel feed, caricata dal suo sito. Se non arriva, non resta un buco. */
function Thumb({ src, className }: { src: string; className: string }) {
  const [ok, setOk] = useState(true)
  return ok ? <img className={className} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setOk(false)} /> : null
}

/** Il dettaglio: l'estratto della fonte, le altre fonti sulla stessa notizia, e il link all'originale. */
function StoryDetail({ story, now }: { story: Story; now: number }) {
  const { t } = useI18n()
  const ago = useAgo(now)
  const it = story.lead
  const cta = t(it.format === 'video' ? 'news.watch' : it.format === 'podcast' ? 'news.listen' : it.format === 'research' ? 'news.readPaper' : 'news.open')
  return (
    <article className="story-detail">
      <Meta s={story} now={now} />
      <h2>{it.title}</h2>
      {it.thumb && <Thumb src={it.thumb} className={`story-hero ${it.format}`} />}
      {it.excerpt && <><p className="group-title">{t('news.fromSource')}</p><p className="story-excerpt">{it.excerpt}</p></>}
      <a className="btn primary wide" href={it.link} target="_blank" rel="noopener noreferrer" onClick={() => tap()}>{cta}<Icon name="external" size={16} /></a>
      {story.others.length > 0 && <>
        <p className="group-title others-title">{t('news.others')}</p>
        <ul className="group-list">{story.others.map(o => (
          <li key={o.id}><a className="row" href={o.link} target="_blank" rel="noopener noreferrer">
            <span className="row-main"><span>{o.title}</span><small>{o.source.name} · {ago(o.published)}{o.source.paywall ? ` · ${t('news.paywall')}` : ''}</small></span>
            <Icon name="external" size={16} className="row-chev" /></a></li>))}</ul>
      </>}
    </article>
  )
}

/** I titoli delle testate, come prima: finché la raccolta del Knowledge Hub non è attiva sul server. */
function Legacy({ items, now }: { items: NewsItem[] | null; now: number }) {
  const { t } = useI18n()
  const ago = useAgo(now)
  if (!items) return <p className="muted news-empty">{t('news.offHint')}</p>
  return (
    <ul className="stories">{items.map(n => (
      <li key={n.link}><a className="story" href={n.link} target="_blank" rel="noopener noreferrer">
        <span className="story-text"><span className="story-title">{n.title}</span><span className="story-meta">{n.source}{n.date ? ` · ${ago(n.date)}` : ''}</span></span>
      </a></li>))}</ul>
  )
}
