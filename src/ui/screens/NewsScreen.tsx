import { useEffect, useMemo, useState } from 'react'
import { tips, type Tip } from '../../content/tips'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { loadNews, type NewsItem } from '../../news/api'
import { loadHub, type HubItem } from '../../news/hub'
import { loadInterests, remember } from '../../news/interests'
import { buildSections, byCategory, type Story } from '../../news/sections'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'

// i filtri in alto: gli argomenti più cercati; le cripto in fondo, separate
const FILTERS = ['personal', 'etf', 'stocks', 'economy', 'markets', 'realestate', 'pension', 'tax', 'saving', 'psychology', 'bonds', 'commodities', 'ai', 'tech', 'startup', 'crypto']

/**
 * Notizie: poche storie scelte ogni giorno, per argomento, da fonti approvate (testate, indipendenti, ricerca, video).
 * Si legge sul sito originale: qui titolo, fonte e l'estratto che la fonte pubblica.
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

  useEffect(() => {
    let alive = true
    void loadHub(lang, tick > 0).then(async h => {
      if (!alive) return
      setNow(Date.now()); setHub(h)
      if (!h) { const old = await loadNews(lang); if (alive) setLegacy(old) }
    })
    return () => { alive = false }
  }, [lang, tick])

  const sections = useMemo(() => (hub && now ? buildSections(hub, now, lang, interests) : []), [hub, now, lang, interests])
  const filtered = useMemo(() => (hub && filter && now ? byCategory(hub, filter, now, lang, interests) : []), [hub, filter, now, lang, interests])
  const read = (s: Story) => { tap(); remember(s.lead); setInterests(loadInterests()); setOpen(s) }

  return (
    <div className="screen news2">
      <div className="sec-head"><h1 className="screen-title">{t('nav.news')}</h1>
        <button className="icon-btn ghost" onClick={() => { tap(); setHub(undefined); setTick(x => x + 1) }} aria-label={t('news.refresh')}><Icon name="refresh" size={20} /></button></div>

      {hub && <div className="news-filters" role="tablist">
        <button role="tab" aria-selected={!filter} className={!filter ? 'on' : ''} onClick={() => { tap(); setFilter(null) }}>{t('news.all')}</button>
        {FILTERS.map(f => <button key={f} role="tab" aria-selected={filter === f} className={`${filter === f ? 'on' : ''}${f === 'crypto' ? ' apart' : ''}`}
          onClick={() => { tap(); setFilter(f); window.scrollTo(0, 0) }}>{t(`cat.${f}` as keyof Dict)}</button>)}
      </div>}

      {hub === undefined ? <div className="news-loading">{[0, 1, 2, 3].map(i => <div key={i} className="skel"><span /><span /></div>)}</div>
        : hub ? (filter
          ? (filtered.length ? <StoryList stories={filtered} now={now} onOpen={read} /> : <p className="muted news-empty">{t('news.empty')}</p>)
          : sections.map(s => <section key={s.id} className="news-section">
              <h2 className="sec-title">{t(`news.sec.${s.id}` as keyof Dict)}</h2>
              <StoryList stories={s.stories} now={now} onOpen={read} lead={s.id === 'today'} />
            </section>))
        : <Legacy items={legacy} now={now} />}

      {!filter && <section className="news-section">
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
          {s.lead.thumb && <img className="story-thumb" src={s.lead.thumb} alt="" loading="lazy" />}
          <span className="story-text"><span className="story-title">{s.lead.title}</span><Meta s={s} now={now} /></span>
        </button></li>
      ))}
    </ul>
  )
}

/** Il dettaglio: l'estratto della fonte, le altre fonti sulla stessa notizia, e il link all'originale. */
function StoryDetail({ story, now }: { story: Story; now: number }) {
  const { t } = useI18n()
  const ago = useAgo(now)
  const it = story.lead
  const cta = it.format === 'video' ? t('news.watch') : it.format === 'research' ? t('news.readPaper') : t('news.open')
  return (
    <article className="story-detail">
      <Meta s={story} now={now} />
      <h2>{it.title}</h2>
      {it.thumb && <img className="story-hero" src={it.thumb} alt="" />}
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
