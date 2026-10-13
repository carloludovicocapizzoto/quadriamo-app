import { useEffect, useState } from 'react'
import { tips, type Tip } from '../../content/tips'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { loadNews, type NewsItem } from '../../news/api'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'

type View = 'forYou' | 'all' | 'tips'

/** Notizie: i titoli di economia (prima quelli che toccano il budget) e i consigli per usare bene il metodo. */
export function NewsScreen({ onAction }: { onAction: (a: NonNullable<Tip['action']>) => void }) {
  const { t, lang } = useI18n()
  const [view, setView] = useState<View>('forYou')
  const [items, setItems] = useState<NewsItem[] | null | undefined>(undefined)
  const [now, setNow] = useState(0)
  const [tick, setTick] = useState(0)
  useEffect(() => { let alive = true; void loadNews(lang).then(x => { if (alive) { setItems(x); setNow(Date.now()) } }); return () => { alive = false } }, [lang, tick])
  const load = (force = false) => {
    if (force) { try { localStorage.removeItem('q.news') } catch { /* niente */ } setItems(undefined) }
    setTick(x => x + 1)
  }
  const ago = (d: string | null) => {
    if (!d || !now) return ''
    const m = Math.round((now - Date.parse(d)) / 60000), rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    return m < 60 ? rtf.format(-Math.max(1, m), 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day')
  }
  const list = (items ?? []).filter(x => view === 'all' || x.forYou)
  const VIEWS: View[] = ['forYou', 'all', 'tips']
  return (
    <div className="screen">
      <div className="sec-head"><h1 className="screen-title">{t('nav.news')}</h1>
        {view !== 'tips' && <button className="icon-btn ghost" onClick={() => { tap(); load(true) }} aria-label={t('news.refresh')}><Icon name="refresh" size={20} /></button>}</div>
      <div className="segmented" role="tablist">
        {VIEWS.map(v => <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => { tap(); setView(v) }}>{t(`news.v.${v}` as keyof Dict)}</button>)}
        <span className="seg-pill" style={{ transform: `translateX(${VIEWS.indexOf(view) * 100}%)` }} />
      </div>

      <div key={view} className="view-in">
        {view === 'tips' ? (
          <ul className="card tip-list tips-page">{tips(lang).map(x => (
            <li key={x.id}><span className="tip-ico"><Icon name={x.icon} size={18} /></span>
              <div><b>{x.title}</b><p>{x.text}</p>
                {x.action && <button className="link-btn" onClick={() => { tap(); onAction(x.action!) }}>{t(`disc.act.${x.action}` as keyof Dict)}<Icon name="chevron" size={15} /></button>}</div></li>))}
          </ul>
        ) : items === undefined ? (
          <section className="card news">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skel"><span /><span /></div>)}</section>
        ) : !items ? (
          <section className="card empty-state"><span className="empty-ico"><Icon name="news" size={28} /></span>
            <b>{t('news.off')}</b><p className="muted small">{t('news.offHint')}</p>
            <button className="btn" onClick={() => load(true)}>{t('news.retry')}</button></section>
        ) : (
          <>
            {view === 'forYou' && <p className="muted small news-intro">{t('news.forYouHint')}</p>}
            <section className="card news"><ul>
              {(list.length ? list : items).map(n => (
                <li key={n.link}><a href={n.link} target="_blank" rel="noopener noreferrer" onClick={() => tap()}>
                  <span className="news-title">{n.title}</span>
                  <span className="news-meta">{n.forYou && view === 'all' && <em className="news-tag">{t('disc.forYou')}</em>}{n.source} · {ago(n.date)}</span></a></li>))}
            </ul><p className="small muted news-note">{t('disc.newsNote')}</p></section>
          </>
        )}
      </div>
    </div>
  )
}
