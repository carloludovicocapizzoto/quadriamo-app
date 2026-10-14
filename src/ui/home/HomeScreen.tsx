import { useMemo, useState } from 'react'
import { daysBetween, todayBudget, type BucketRow, type ClassifiedTx, type MonthResult } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { Icon } from '../Icon'
import { tap, useCountUp } from '../kit/motion'
import { Money } from '../kit/Money'
import { Meter } from '../kit/Meter'
import { Outcome } from '../Outcome'
import { Sheet } from '../kit/Sheet'
import { BUCKET_COLORS, bucketName } from '../names'
import { TxRow } from '../TxRow'

/**
 * Home: una domanda sola, "quanto posso spendere oggi?".
 * Il numero del giorno è il protagonista; sotto, i quattro blocchi che si svuotano mentre spendi e le spese di oggi.
 * Tutto il resto vive altrove: l'analisi in Analisi, i consigli in Notizie, slancio e traguardi in Profilo.
 */
export function HomeScreen({ data, r, today, onAdd, onOpen, onAll }: {
  data: AppData; r: MonthResult; today: string
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

      <Today r={r} today={today} settings={s} onOpen={onOpen} onAll={onAll} />

      <Sheet open={!!part} onClose={() => setPart(null)} title={part ? bucketName(part.bucket, t) : ''}>
        {part && <PartDetail b={part} r={r} cur={cur} color={BUCKET_COLORS[r.buckets.indexOf(part)]} onOpen={tx => { setPart(null); onOpen(tx) }}
                             onAll={() => { setPart(null); onAll() }} settings={s} />}
      </Sheet>
    </div>
  )
}

/** Le spese di oggi (al massimo tre) e la strada per tutte le altre. Lo slancio si aggiorna da solo a ogni movimento. */
function Today({ r, today, settings, onOpen, onAll }: {
  r: MonthResult; today: string; settings: AppData['settings']; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t } = useI18n()
  const list = r.transactions.filter(x => !x.upcoming && x.date === today)
  return (
    <section className="today">
      <h2 className="sec-title">{t('day.today')}</h2>
      {list.length ? <ul className="tx-list">{list.slice(0, 3).map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
        : <p className="today-none muted">{t('home.nothingToday')}</p>}
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
    {/* quanto rimane è il protagonista; la linea si riempie con quanto hai speso, nel colore della parte */}
    <Outcome value={b.remaining} currency={cur} label={t(b.remaining < 0 ? 'part.over' : 'part.leftOf', { amount: money(b.available, cur) })}
      totals={[{ label: t('bucket.spent'), value: b.spent }, { label: t('part.used'), value: `${Math.round(used * 100)}%` }]}>
      <Meter value={used} color={color} label={t('part.used')} />
    </Outcome>
    <p className="day-label">{t('part.last')}</p>
    {txs.length ? <ul className="tx-list">{txs.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
      : <p className="muted small">{t('month.noSpending')}</p>}
    <button className="btn wide top-gap" onClick={onAll}>{t('w.seeAll')}</button>
  </>
}
