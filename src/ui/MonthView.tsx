import { useState } from 'react'
import { FIRST, forecastMonth, paydayPlan, ymKey, type ClassifiedTx, type MonthResult, type Settings } from '../engine'
import { useStore } from '../store/context'
import { useI18n } from '../i18n/core'
import { usePlan } from '../billing/plan'
import { Checks } from './Checks'
import { DailyChart } from './DailyChart'
import { Money } from './kit/Money'
import { BUCKET_COLORS, bucketName, categoryName } from './names'
import { TxRow } from './TxRow'

/**
 * Il mese, in un ordine solo: come finisce (il protagonista), le quattro parti, giorno per giorno, per categoria.
 * Quanto si può spendere oggi non c'è: è la Home.
 */
export function MonthView({ r, settings, onOpen, today }: { r: MonthResult; settings: Settings; onOpen: (tx: ClassifiedTx) => void; today: string }) {
  const { t } = useI18n()
  const cats = r.byCategory.filter(c => c.amount !== 0).sort((a, b) => b.amount - a.amount)
  const top = cats[0]?.amount ?? 1
  return (
    <>
      <Outcome r={r} settings={settings} today={today} />

      <h2 className="sec-title">{t('ana.parts')}</h2>
      <Parts r={r} settings={settings} onOpen={onOpen} />

      <h2 className="sec-title">{t('ana.daily')}</h2>
      <DailyChart r={r} settings={settings} today={today} />

      {cats.length > 0 && <>
        <h2 className="sec-title">{t('month.byCategory')}</h2>
        <ul className="by-cat">
          {cats.map(c => (
            <li key={c.category.id}>
              <span className="by-cat-name">{categoryName(c.category, t)}</span>
              <Money className="by-cat-amount" value={c.amount} currency={settings.currency} />
              <span className="by-cat-bar" aria-hidden="true"><span style={{ transform: `scaleX(${c.amount / top})` }} /></span>
            </li>
          ))}
        </ul>
      </>}

      <Payday r={r} settings={settings} />
    </>
  )
}

/** Come finisce il mese: per quello in corso, la previsione a questo ritmo; per gli altri, com'è andata davvero. */
function Outcome({ r, settings, today }: { r: MonthResult; settings: Settings; today: string }) {
  const { t, money } = useI18n()
  const plan = usePlan()
  const cur = settings.currency
  const f = plan.pro ? forecastMonth(r, today) : null
  const now = today >= r.period.start && today <= r.period.end
  const value = f ? f.projectedLeftOver : r.leftOver
  const label = f ? (value < 0 ? t('ana.endOver') : t('ana.endLeft'))
    : now ? (value < 0 ? t('ana.overNow') : t('ana.leftNow')) : (value < 0 ? t('ana.overPast') : t('ana.leftPast'))
  return (
    <section className="outcome">
      <Money className={`outcome-amount${value < 0 ? ' bad' : ''}`} value={Math.abs(value)} currency={cur} />
      <p className="outcome-label">{label}</p>
      <Checks checks={r.checks} />
      {f && <p className="outcome-detail">{t(f.upcoming > 0 ? 'rep.detail' : 'rep.detailNoUp',
        { spent: money(f.spentSoFar, cur), upcoming: money(f.upcoming, cur), perDay: money(f.variablePerDay, cur) })}</p>}
      <dl className="outcome-row">
        <div><dt>{t('month.income')}</dt><dd><Money value={r.income} currency={cur} /></dd></div>
        <div><dt>{t('month.spent')}</dt><dd><Money value={r.spent} currency={cur} /></dd></div>
        <div><dt>{t('ana.saved')}</dt><dd><Money value={r.saved} currency={cur} /></dd></div>
      </dl>
      {r.transactions.length === 0 && <p className="muted small">{t('month.empty')}</p>}
    </section>
  )
}

/** Le quattro parti come righe: il blocco che si svuota, quanto resta; toccandole si aprono i loro movimenti. */
function Parts({ r, settings, onOpen }: { r: MonthResult; settings: Settings; onOpen: (tx: ClassifiedTx) => void }) {
  const { t, money } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  const cur = settings.currency
  return (
    <ul className="part-rows">
      {r.buckets.map((b, i) => {
        const rest = b.available > 0 ? Math.max(0, Math.min(1, b.remaining / b.available)) : 0
        const list = (r.spendingByBucket[b.bucket.id] ?? []).slice().reverse()
        const isOpen = open === b.bucket.id
        return (
          <li key={b.bucket.id}>
            <button className="part-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : b.bucket.id)}
                    style={{ ['--bc' as string]: BUCKET_COLORS[i] }}>
              <span className={`part-block${b.remaining < 0 ? ' over' : ''}`} aria-hidden="true"><span style={{ transform: `scaleY(${rest})` }} /></span>
              <span className="part-main">
                <span>{bucketName(b.bucket, t)}</span>
                <small>{t('ana.partSub', { spent: money(b.spent, cur), available: money(b.available, cur) })}</small>
              </span>
              <Money className={`part-left${b.remaining < 0 ? ' bad' : ''}`} value={b.remaining} currency={cur} />
            </button>
            {isOpen && (list.length
              ? <ul className="tx-list part-txs">{list.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
              : <p className="muted small part-txs">{t('month.noSpending')}</p>)}
          </li>
        )
      })}
    </ul>
  )
}

/** Il giorno di paga: prima l'affitto, poi quanto spostare in ogni pocket. Solo nei mesi con entrate. */
function Payday({ r, settings }: { r: MonthResult; settings: Settings }) {
  const { t, money } = useI18n()
  const { state, dispatch } = useStore()
  const plan = paydayPlan(r)
  if (!plan.length) return null
  const monthKey = ymKey(r.ym)
  const moved = state.data?.payday?.[monthKey] ?? []
  const bucketOf = (id: string) => settings.buckets.find(b => b.id === id)!
  const colorOf = (id: string) => BUCKET_COLORS[settings.buckets.findIndex(b => b.id === id)]
  return <>
    <h2 className="sec-title">{t('pay.title')}{plan.every(p => moved.includes(p.bucketId)) && <span className="pill good">{t('pay.done')}</span>}</h2>
    <p className="muted small">{t('pay.hint')}</p>
    {r.paidFirst > 0 && <p className="pay-first">{t('pay.first', { amount: money(r.paidFirst, settings.currency),
      what: settings.categories.filter(c => c.defaultBucket === FIRST).map(c => categoryName(c, t)).join(', ') })}</p>}
    <ul className="pay-list">
      {plan.map(p => (
        <li key={p.bucketId}>
          <label className="check">
            <input type="checkbox" checked={moved.includes(p.bucketId)}
                   onChange={() => dispatch({ type: 'togglePayday', month: monthKey, bucketId: p.bucketId })} />
            <i style={{ background: colorOf(p.bucketId) }} />
            <span className={moved.includes(p.bucketId) ? 'done' : ''}>
              {t('pay.move', { amount: money(p.amount, settings.currency), bucket: bucketName(bucketOf(p.bucketId), t) })}</span>
          </label>
        </li>
      ))}
    </ul>
  </>
}
