import { useState } from 'react'
import { FIRST, paydayPlan, safeToSpend, ymKey, type ClassifiedTx, type MonthResult, type Settings } from '../engine'
import { useStore } from '../store/context'
import { useI18n } from '../i18n/core'
import { Checks } from './Checks'
import { HomeCharts } from './HomeCharts'
import { BUCKET_COLORS, bucketName, categoryName } from './names'
import { TxRow } from './TxRow'

export function MonthView({ r, settings, onOpen, today }: { r: MonthResult; settings: Settings; onOpen: (tx: ClassifiedTx) => void; today: string }) {
  const { t, money, date } = useI18n()
  const { state, dispatch } = useStore()
  const safe = safeToSpend(r, settings, today)
  const plan = paydayPlan(r)
  const monthKey = ymKey(r.ym)
  const moved = state.data?.payday?.[monthKey] ?? []
  const bucketOf = (id: string) => settings.buckets.find(b => b.id === id)!
  const colorOf = (id: string) => BUCKET_COLORS[settings.buckets.findIndex(b => b.id === id)]
  const [open, setOpen] = useState<string | null>(null)
  const cur = settings.currency
  const cats = r.byCategory.filter(c => c.amount !== 0)

  return (
    <>
      <HomeCharts r={r} settings={settings} today={today} />
      {safe.length > 0 && (
        <section className="card safe">
          <h3 className="h-plain">{t('safe.title')}</h3>
          <div className="safe-grid">
            {safe.map(x => (
              <div key={x.bucketId} className="safe-item">
                <span className="safe-name"><i style={{ background: colorOf(x.bucketId) }} />{bucketName(bucketOf(x.bucketId), t)}</span>
                {x.free >= 0
                  ? <strong className="safe-amount">{t('safe.perDay', { amount: money(x.perDay, settings.currency) })}</strong>
                  : <strong className="safe-amount bad-text">{t('safe.over', { amount: money(-x.free, settings.currency) })}</strong>}
                <span className="muted small">{t('safe.detail', { free: money(Math.max(0, x.free), settings.currency),
                  end: date(r.period.end), days: x.daysLeft })}</span>
                {x.reserved > 0 && <span className="muted small">{t('safe.reserved', { amount: money(x.reserved, settings.currency) })}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {plan.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3 className="h-plain">{t('pay.title')}</h3>
            {plan.every(p => moved.includes(p.bucketId)) && <span className="pill good">{t('pay.done')}</span>}
          </div>
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
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3 className="h-plain">{t('month.title')}</h3>
          <Checks checks={r.checks} />
        </div>
        <dl className="summary">
          {([['month.income', r.income], ['month.spent', r.spent], ['month.saved', r.saved],
             ['month.leftOver', r.leftOver]] as const).map(([k, v]) => (
            <div key={k}><dt>{t(k)}</dt><dd className={k === 'month.leftOver' && v < 0 ? 'bad-text' : ''}>{money(v, cur)}</dd></div>
          ))}
        </dl>
        {r.transactions.length === 0 && <p className="muted small top-gap">{t('month.empty')}</p>}
      </section>

      <section className="buckets">
        {r.buckets.map((b, i) => {
          const used = b.available > 0 ? Math.min(1, b.spent / b.available) : b.spent > 0 ? 1 : 0
          const list = r.spendingByBucket[b.bucket.id] ?? []
          const isOpen = open === b.bucket.id
          return (
            <article key={b.bucket.id} className="card bucket">
              <div className="card-head">
                <h3><i style={{ background: BUCKET_COLORS[i] }} />{bucketName(b.bucket, t)}</h3>
                <span className="muted small">{Math.round(b.bucket.share * 100)}%</span>
              </div>
              <div className={b.remaining < 0 ? 'big bad-text' : 'big'}>{money(b.remaining, cur)}</div>
              <div className="muted small">{t('bucket.remaining')}</div>
              <div className="bar" role="presentation"><div style={{ width: `${used * 100}%`, background: BUCKET_COLORS[i] }} /></div>
              <dl className="mini">
                <div><dt>{t('bucket.carried')}</dt><dd>{money(b.carriedOver, cur)}</dd></div>
                <div><dt>{t('bucket.fromIncome')}</dt><dd>{money(b.fromIncome, cur)}</dd></div>
                <div><dt>{t('bucket.spent')}</dt><dd>{money(b.spent, cur)}</dd></div>
              </dl>
              <button className="link-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : b.bucket.id)}>
                {isOpen ? t('month.hideList') : t('month.showList')} ({list.length})
              </button>
              {isOpen && (list.length
                ? <ul className="tx-list">{list.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
                : <p className="muted small">{t('month.noSpending')}</p>)}
            </article>
          )
        })}
      </section>

      {cats.length > 0 && (
        <section className="card">
          <h3 className="h-plain">{t('month.byCategory')}</h3>
          <ul className="cats">
            {cats.map(c => (
              <li key={c.category.id}>
                <span>{categoryName(c.category, t)}</span>
                <span className="bar thin" role="presentation"><span style={{ width: `${c.share * 100}%` }} /></span>
                <span className="num">{money(c.amount, cur)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
