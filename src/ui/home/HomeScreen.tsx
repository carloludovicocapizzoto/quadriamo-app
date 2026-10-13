import { useMemo, useState } from 'react'
import { daysBetween, todayBudget, type BucketRow, type ClassifiedTx, type MonthResult, type Streak } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { useStore } from '../../store/context'
import { Icon } from '../Icon'
import { tap, useCountUp } from '../kit/motion'
import { Money } from '../kit/Money'
import { Ring } from '../kit/Ring'
import { Sheet } from '../kit/Sheet'
import { BUCKET_COLORS, bucketName } from '../names'
import { TxRow } from '../TxRow'

/**
 * Home: una domanda sola, "quanto posso spendere oggi?".
 * Il numero del giorno è il protagonista; sotto, i quattro blocchi che si svuotano mentre spendi e le spese di oggi.
 * Tutto il resto vive altrove: l'analisi in Analisi, i consigli in Notizie, slancio e traguardi in Profilo.
 */
export function HomeScreen({ data, r, today, streak, onAdd, onOpen, onAll }: {
  data: AppData; r: MonthResult; today: string; streak: Streak | null
  onAdd: (kind: 'expense' | 'income') => void; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t, date } = useI18n()
  const s = data.settings, cur = s.currency
  const budget = useMemo(() => todayBudget(r, s, today), [r, s, today])
  const [part, setPart] = useState<BucketRow | null>(null)
  const left = useCountUp(budget.left)
  const daysLeft = daysBetween(today, r.period.end) + 1
  const hasPlan = budget.parts.length > 0 && r.income > 0
  const day = date(today, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="home">
      <p className="home-date">{day.charAt(0).toUpperCase() + day.slice(1)}</p>

      {hasPlan ? <section className="hero" aria-live="polite">
        <Money className="hero-amount" value={left} currency={cur} />
        <p className="hero-sub">{daysLeft > 1 ? t('home.heroSub', { n: daysLeft }) : t('home.heroLast')}</p>
      </section> : <section className="hero">
        <p className="hero-empty">{t('home.noSalary')}</p>
        <button className="btn primary" onClick={() => onAdd('income')}>{t('home.addSalary')}</button>
      </section>}

      <div className="blocks">
        {r.buckets.map((b, i) => {
          const rest = b.available > 0 ? Math.max(0, Math.min(1, b.remaining / b.available)) : 0
          return (
            <button key={b.bucket.id} className={`block${b.remaining < 0 ? ' over' : ''}`} style={{ ['--bc' as string]: BUCKET_COLORS[i] }}
                    onClick={() => { tap(); setPart(b) }}>
              <span className="block-shape" aria-hidden="true"><span style={{ transform: `scaleY(${rest})` }} /></span>
              <Money className="block-amount" value={b.remaining} currency={cur} bare />
              <span className="block-name">{bucketName(b.bucket, t)}</span>
            </button>
          )
        })}
      </div>

      <Today r={r} today={today} settings={s} streak={streak} onOpen={onOpen} onAll={onAll} />

      <Sheet open={!!part} onClose={() => setPart(null)} title={part ? bucketName(part.bucket, t) : ''}>
        {part && <PartDetail b={part} r={r} cur={cur} color={BUCKET_COLORS[r.buckets.indexOf(part)]} onOpen={tx => { setPart(null); onOpen(tx) }}
                             onAll={() => { setPart(null); onAll() }} settings={s} />}
      </Sheet>
    </div>
  )
}

/** Le spese di oggi (al massimo tre) e la strada per tutte le altre. Senza spese, la giornata si può segnare per lo slancio. */
function Today({ r, today, settings, streak, onOpen, onAll }: {
  r: MonthResult; today: string; settings: AppData['settings']; streak: Streak | null; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t } = useI18n()
  const { dispatch } = useStore()
  const list = r.transactions.filter(x => !x.upcoming && x.date === today)
  return (
    <section className="today">
      <h2 className="sec-title">{t('day.today')}</h2>
      {list.length ? <ul className="tx-list">{list.slice(0, 3).map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
        : <div className="today-none">
          <span className="muted">{t('home.nothingToday')}</span>
          {streak?.doneToday ? <span className="muted"><Icon name="check" size={16} className="inline-ico" />{t('home.dayMarked')}</span>
            : <button className="link-btn" onClick={() => { tap(); dispatch({ type: 'checkIn' }) }}>{t('home.markDay')}</button>}
        </div>}
      <button className="row-link" onClick={onAll}><span>{t('home.allTx')}</span><Icon name="chevron" size={18} /></button>
    </section>
  )
}

function PartDetail({ b, r, cur, color, settings, onOpen, onAll }: {
  b: BucketRow; r: MonthResult; cur: string; color: string; settings: AppData['settings']; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t, money } = useI18n()
  const used = b.available > 0 ? Math.max(0, Math.min(1, 1 - b.remaining / b.available)) : 0
  const txs = (r.spendingByBucket[b.bucket.id] ?? []).filter(x => !x.upcoming).slice(-6).reverse()
  return <>
    <div className="pd-top">
      <Ring value={used} size={96} stroke={9} color={color}><b>{Math.round(used * 100)}%</b></Ring>
      <dl className="pd-stats">
        <div><dt>{t('bucket.available')}</dt><dd>{money(b.available, cur)}</dd></div>
        <div><dt>{t('bucket.spent')}</dt><dd>{money(b.spent, cur)}</dd></div>
        <div><dt>{t('bucket.remaining')}</dt><dd className={b.remaining < 0 ? 'bad-text' : ''}>{money(b.remaining, cur)}</dd></div>
      </dl>
    </div>
    <p className="day-label">{t('part.last')}</p>
    {txs.length ? <ul className="tx-list">{txs.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
      : <p className="muted small">{t('month.noSpending')}</p>}
    <button className="btn wide top-gap" onClick={onAll}>{t('w.seeAll')}</button>
  </>
}
