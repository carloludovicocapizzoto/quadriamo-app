import { useState } from 'react'
import type { ClassifiedTx, MonthResult, Settings } from '../engine'
import { useI18n } from '../i18n/core'
import { Checks } from './Checks'
import { BUCKET_COLORS, bucketName, categoryName } from './names'
import { TxRow } from './TxRow'

export function MonthView({ r, settings, onOpen }: { r: MonthResult; settings: Settings; onOpen: (tx: ClassifiedTx) => void }) {
  const { t, money } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  const cur = settings.currency
  const cats = r.byCategory.filter(c => c.amount !== 0)

  return (
    <>
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
