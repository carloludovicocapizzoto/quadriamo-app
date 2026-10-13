import { useEffect, useState } from 'react'
import { BANKS, tipOfDay, tips, type Tip } from '../../content/tips'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { loadNews, type NewsItem } from '../../news/api'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'

type Act = (a: NonNullable<Tip['action']>) => void

/** Il consiglio di oggi (con la guida alle banche) e le notizie di economia. */
export function Discover({ today, firstDay, onAction }: { today: string; firstDay?: string; onAction: Act }) {
  const { lang } = useI18n()
  const tip = tipOfDay(lang, today, firstDay)
  return <><TipCard tip={tip} onAction={onAction} /><News /></>
}

function TipCard({ tip, onAction }: { tip: Tip; onAction: Act }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<'all' | 'banks' | null>(null)
  const act = (a: Tip['action']) => { if (!a) return; tap(); if (a === 'banks') setOpen('banks'); else { setOpen(null); onAction(a) } }
  return (
    <>
      <section className="card tip">
        <div className="tip-head"><span className="tip-ico"><Icon name={tip.icon} size={20} /></span><span className="eyebrow">{t('disc.tip')}</span></div>
        <h3 className="tip-title">{tip.title}</h3>
        <p className="tip-text">{tip.text}</p>
        <div className="tip-actions">
          {tip.action && <button className="btn small-btn primary" onClick={() => act(tip.action)}>{t(`disc.act.${tip.action}` as keyof Dict)}</button>}
          <button className="link-btn" onClick={() => { tap(); setOpen('all') }}>{t('disc.moreTips')}<Icon name="chevron" size={16} /></button>
        </div>
      </section>

      <Sheet open={open === 'all'} onClose={() => setOpen(null)} title={t('disc.allTips')}>
        <ul className="tip-list">{tips(lang).map(x => (
          <li key={x.id}><span className="tip-ico"><Icon name={x.icon} size={18} /></span>
            <div><b>{x.title}</b><p>{x.text}</p>
              {x.action && <button className="link-btn" onClick={() => act(x.action)}>{t(`disc.act.${x.action}` as keyof Dict)}<Icon name="chevron" size={15} /></button>}</div></li>))}
        </ul>
      </Sheet>
      <Sheet open={open === 'banks'} onClose={() => setOpen(null)} title={t('banks.title')}>
        <BankGuide />
      </Sheet>
    </>
  )
}

function BankGuide() {
  const { t, lang } = useI18n()
  const l = (lang in BANKS[0].note ? lang : 'en') as keyof typeof BANKS[number]['note']
  return (
    <div className="bank-guide">
      <p>{t('banks.intro')}</p>
      <ol className="bank-steps">
        <li>{t('banks.s1')}</li><li>{t('banks.s2')}</li><li>{t('banks.s3')}</li>
      </ol>
      <p className="day-label">{t('banks.which')}</p>
      <ul className="bank-list">{BANKS.map(b => (
        <li key={b.name}><span className="bank-logo">{b.name.charAt(0).toUpperCase()}</span>
          <div><b>{b.name}</b><span>{b.feature[l]}</span><small className="muted">{b.note[l]}</small></div></li>))}
      </ul>
      <p className="small muted">{t('banks.note')}</p>
    </div>
  )
}

function News() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [all, setAll] = useState(false)
  const [mine, setMine] = useState(false)
  const [now, setNow] = useState(0)   // ora del caricamento, per "2 ore fa"
  useEffect(() => { let alive = true; void loadNews(lang).then(x => { if (alive) { setItems(x); setNow(Date.now()) } }); return () => { alive = false } }, [lang])
  if (!items || !items.length) return null
  const ago = (d: string | null) => {
    if (!d) return ''
    const m = Math.round((now - Date.parse(d)) / 60000), rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    return m < 60 ? rtf.format(-Math.max(1, m), 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day')
  }
  const row = (n: NewsItem) => (
    <li key={n.link}><a href={n.link} target="_blank" rel="noopener noreferrer" onClick={() => tap()}>
      <span className="news-title">{n.title}</span>
      <span className="news-meta">{n.forYou && <em className="news-tag">{t('disc.forYou')}</em>}{n.source} · {ago(n.date)}</span></a></li>)
  const first = [...items.filter(x => x.forYou).slice(0, 2), ...items.filter(x => !x.forYou)].slice(0, 4)
  return (
    <>
      <div className="sec-head"><h2 className="sec-title">{t('disc.news')}</h2>
        <button className="link-btn" onClick={() => { tap(); setAll(true) }}>{t('disc.allNews')}<Icon name="chevron" size={16} /></button></div>
      <section className="card news"><ul>{first.map(row)}</ul><p className="small muted news-note">{t('disc.newsNote')}</p></section>
      <Sheet open={all} onClose={() => setAll(false)} title={t('disc.news')}>
        <label className="check small"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />{t('disc.onlyForYou')}</label>
        <div className="news"><ul>{items.filter(x => !mine || x.forYou).map(row)}</ul></div>
        <p className="small muted news-note">{t('disc.newsNote')}</p>
      </Sheet>
    </>
  )
}
