import { useMemo, useState, type ReactNode } from 'react'
import { computeMonth, dailySpending, daysBetween, prevMonth, safeToSpend, type ClassifiedTx, type MonthResult, type Streak } from '../engine'
import type { AppData } from '../store/state'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useStore } from '../store/context'
import { BucketDonut, DailyChart } from './HomeCharts'
import { BUCKET_COLORS, bucketName, categoryName } from './names'
import { StreakCard } from './Streak'
import { TxRow } from './TxRow'

// widget disponibili; i primi quattro sono quelli di partenza
const WIDGETS = ['left', 'today', 'flow', 'recent', 'donut', 'daily', 'categories', 'compare', 'upcoming', 'savings', 'shared'] as const
type WidgetId = typeof WIDGETS[number]
const DEFAULT_HOME: WidgetId[] = ['left', 'today', 'flow', 'recent']
const isWidget = (x: string): x is WidgetId => (WIDGETS as readonly string[]).includes(x)

/** Home: solo l'essenziale, a widget che ognuno sceglie e ordina (la scelta si salva e si sincronizza). */
export function HomeView({ data, r, today, streak, onOpen, onAll, onShared }: {
  data: AppData; r: MonthResult; today: string; streak: Streak | null; onOpen: (tx: ClassifiedTx) => void; onAll: () => void; onShared: () => void
}) {
  const { t } = useI18n()
  const { dispatch } = useStore()
  const [edit, setEdit] = useState(false)
  const active = (data.home ?? DEFAULT_HOME).filter(isWidget)
  const save = (w: WidgetId[]) => dispatch({ type: 'setHome', widgets: w })
  const move = (i: number, d: number) => { const w = [...active]; [w[i], w[i + d]] = [w[i + d], w[i]]; save(w) }
  return (
    <div className="home">
      <div className="home-head">
        <div><h1>{t('home.titleMain')}</h1><p className="muted small">{t(`m.${r.ym.month}` as keyof Dict)} {r.ym.year}</p></div>
        <button className={`btn small-btn${edit ? ' primary' : ''}`} onClick={() => setEdit(!edit)}>{edit ? `✓ ${t('home.done')}` : `✎ ${t('home.edit')}`}</button>
      </div>
      {streak && !edit && <StreakCard s={streak} today={today} />}
      {edit && <p className="muted small">{t('home.editHint')}</p>}
      {!active.length && !edit && <p className="muted">{t('home.empty')}</p>}

      <div className="widgets">
        {active.map((id, i) => (
          <section key={id} className={`card widget wid-${id}${edit ? ' editing' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="w-head">
              <h3 className="h-plain">{t(`w.${id}` as keyof Dict)}</h3>
              {edit && <div className="w-tools">
                <button className="icon-btn" aria-label="↑" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" aria-label="↓" disabled={i === active.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="icon-btn" aria-label={t('action.delete')} onClick={() => save(active.filter(x => x !== id))}>✕</button>
              </div>}
            </div>
            <Widget id={id} data={data} r={r} today={today} onOpen={onOpen} onAll={onAll} onShared={onShared} />
          </section>
        ))}
      </div>

      {edit && (
        <section className="card catalog">
          <h3 className="h-plain">{t('home.add')}</h3>
          {WIDGETS.filter(w => !active.includes(w)).length === 0 && <p className="muted small">{t('home.allAdded')}</p>}
          <ul>
            {WIDGETS.filter(w => !active.includes(w)).map(w => (
              <li key={w}>
                <div><b>{t(`w.${w}` as keyof Dict)}</b><span className="muted small">{t(`w.${w}D` as keyof Dict)}</span></div>
                <button className="btn small-btn" onClick={() => save([...active, w])}>+ {t('home.addOne')}</button>
              </li>
            ))}
          </ul>
          <button className="link-btn" onClick={() => save(DEFAULT_HOME)}>{t('home.reset')}</button>
        </section>
      )}
    </div>
  )
}

function Widget({ id, data, r, today, onOpen, onAll, onShared }: {
  id: WidgetId; data: AppData; r: MonthResult; today: string; onOpen: (tx: ClassifiedTx) => void; onAll: () => void; onShared: () => void
}) {
  const { t, money, date, lang } = useI18n()
  const s = data.settings
  const cur = s.currency
  const colorOf = (bid: string) => BUCKET_COLORS[s.buckets.findIndex(b => b.id === bid)]
  const prev = useMemo(() => computeMonth(prevMonth(r.ym), data.transactions, s, today), [r.ym, data.transactions, s, today])

  switch (id) {
    case 'left': {
      const total = r.buckets.reduce((a, b) => a + b.remaining, 0)
      return <>
        <div className={`w-big${total < 0 ? ' bad-text' : ''}`}>{money(total, cur)}</div>
        <ul className="w-bars">
          {r.buckets.map((b, i) => {
            const left = b.available > 0 ? Math.max(0, Math.min(1, b.remaining / b.available)) : 0
            return <li key={b.bucket.id}><span><i style={{ background: BUCKET_COLORS[i] }} />{bucketName(b.bucket, t)}</span>
              <span className="track"><span style={{ width: `${left * 100}%`, background: BUCKET_COLORS[i] }} /></span>
              <b className={b.remaining < 0 ? 'bad-text' : ''}>{money(b.remaining, cur)}</b></li>
          })}
        </ul>
      </>
    }
    case 'today': {
      const safe = safeToSpend(r, s, today)
      if (!safe.length) return <p className="muted small">{t('w.todayNone')}</p>
      return <ul className="w-today">
        {safe.map(x => (
          <li key={x.bucketId}><span className="muted small"><i style={{ background: colorOf(x.bucketId) }} />{bucketName(s.buckets.find(b => b.id === x.bucketId)!, t)}</span>
            {x.free >= 0 ? <strong>{t('safe.perDay', { amount: money(x.perDay, cur) })}</strong>
              : <strong className="bad-text">{t('safe.over', { amount: money(-x.free, cur) })}</strong>}</li>
        ))}
      </ul>
    }
    case 'flow': {
      const out = r.spent + r.saved
      const pct = r.income > 0 ? Math.min(1, out / r.income) : 0
      return <>
        <dl className="w-flow">
          <div><dt>{t('month.income')}</dt><dd>{money(r.income, cur)}</dd></div>
          <div><dt>{t('month.spent')}</dt><dd>{money(r.spent, cur)}</dd></div>
          <div><dt>{t('month.saved')}</dt><dd>{money(r.saved, cur)}</dd></div>
          <div><dt>{t('month.leftOver')}</dt><dd className={r.leftOver < 0 ? 'bad-text' : 'good-text'}>{money(r.leftOver, cur)}</dd></div>
        </dl>
        <div className="w-meter" role="img" aria-label={t('w.flowUsed', { n: Math.round(pct * 100) })}><span style={{ width: `${pct * 100}%` }} /></div>
        <p className="muted small">{t('w.flowUsed', { n: Math.round(pct * 100) })}</p>
      </>
    }
    case 'recent': {
      const list = r.transactions.filter(x => !x.upcoming && x.date && x.date <= today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5)
      return <>
        {list.length ? <ul className="tx-list">{list.map(tx => <TxRow key={tx.id} tx={tx} settings={s} onOpen={onOpen} />)}</ul>
          : <p className="muted small">{t('w.noRecent')}</p>}
        <button className="link-btn" onClick={onAll}>{t('w.seeAll')} →</button>
      </>
    }
    case 'donut': return <BucketDonut r={r} settings={s} />
    case 'daily': return <DailyChart r={r} settings={s} today={today} />
    case 'categories': {
      const cats = r.byCategory.filter(c => c.amount > 0 && c.category.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 6)
      const max = Math.max(1, ...cats.map(c => c.amount))
      if (!cats.length) return <p className="muted small">{t('home.noSpend')}</p>
      return <ul className="w-bars">
        {cats.map(c => <li key={c.category.id}><span>{categoryName(c.category, t)}</span>
          <span className="track"><span style={{ width: `${(c.amount / max) * 100}%` }} /></span><b>{money(c.amount, cur)}</b></li>)}
      </ul>
    }
    case 'compare': {
      const idx = Math.max(0, Math.min(daysBetween(r.period.start, today), daysBetween(r.period.start, r.period.end)))
      const now = dailySpending(r)[idx]?.cumulative ?? 0
      const pd = dailySpending(prev)
      const before = pd[Math.min(idx, pd.length - 1)]?.cumulative ?? 0
      const diff = now - before
      const pct = before > 0 ? Math.round((diff / before) * 100) : null
      const prevName = lang === 'en' ? t(`m.${prev.ym.month}` as keyof Dict) : t(`m.${prev.ym.month}` as keyof Dict).toLowerCase()
      return <>
        <div className={`w-big ${diff > 0 ? 'bad-text' : 'good-text'}`}>{diff > 0 ? '+' : ''}{money(diff, cur)}{pct != null && <small> ({diff > 0 ? '+' : ''}{pct}%)</small>}</div>
        <p className="small">{t(diff > 0 ? 'w.compareMore' : 'w.compareLess', { month: prevName })}</p>
        <p className="muted small">{t('w.compareDetail', { now: money(now, cur), before: money(before, cur), month: prevName })}</p>
      </>
    }
    case 'upcoming': {
      const list = r.transactions.filter(x => x.upcoming).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      if (!list.length) return <p className="muted small">{t('w.noUpcoming')}</p>
      return <ul className="w-upcoming">
        {list.map(x => <li key={x.id}><span className="muted small">{x.date ? date(x.date, { day: 'numeric', month: 'short' }) : ''}</span>
          <span>{x.description || categoryName(s.categories.find(c => c.id === x.category), t)}</span><b>{money(x.amountIn || x.amount || 0, cur)}</b></li>)}
      </ul>
    }
    case 'shared':
      return <><p className="muted small">{t('w.sharedNone')}</p><button className="btn small-btn" onClick={onShared}>👥 {t('w.sharedOpen')} →</button></>
    case 'savings': {
      const keep = r.buckets.slice(2)
      return <>
        <div className="w-big good-text">{money(r.saved, cur)}</div>
        <p className="muted small">{t('w.savedMonth')}</p>
        <ul className="w-bars plain-bars">
          {keep.map((b, i) => <li key={b.bucket.id}><span><i style={{ background: BUCKET_COLORS[i + 2] }} />{bucketName(b.bucket, t)}</span><span /><b>{money(b.remaining, cur)}</b></li>)}
        </ul>
        <p className="muted small">{t('w.accumulated')}</p>
      </>
    }
  }
  return null as ReactNode
}
