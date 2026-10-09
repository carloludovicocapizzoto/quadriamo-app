import { useMemo } from 'react'
import { computeYear, computeYears, type Settings, type Transaction, type YearMonth } from '../engine'
import { useI18n } from '../i18n/core'
import { BUCKET_COLORS, bucketName, categoryName } from './names'

const pctFmt = (n: number | null, lang: string) =>
  n == null ? '—' : new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }).format(n)

export function YearNav({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const { t } = useI18n()
  return (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => onChange(year - 1)} aria-label={t('year.prev')}>‹</button>
      <h2>{year}</h2>
      <button className="icon-btn" onClick={() => onChange(year + 1)} aria-label={t('year.next')}>›</button>
    </div>
  )
}

/** Barre mese per mese: entrate, spese, risparmi. Tocco su un mese = apri quel mese. */
function YearChart({ rows, currency, onOpenMonth }: {
  rows: { month: number; income: number; spent: number; saved: number }[]; currency: string; onOpenMonth: (m: number) => void
}) {
  const { t, money } = useI18n()
  const max = Math.max(1, ...rows.flatMap(r => [r.income, r.spent, r.saved]))
  const H = 140
  const series = [
    { key: 'income', label: t('month.income'), color: 'var(--b4)' },
    { key: 'spent', label: t('month.spent'), color: 'var(--accent)' },
    { key: 'saved', label: t('month.saved'), color: 'var(--text)' },
  ] as const
  return (
    <figure className="chart">
      <div className="chart-bars" style={{ height: H }}>
        {rows.map(r => (
          <button key={r.month} className="chart-month" onClick={() => onOpenMonth(r.month)}
                  aria-label={`${t(`m.${r.month}` as 'm.1')}: ${series.map(s => `${s.label} ${money(r[s.key], currency)}`).join(', ')}`}>
            <span className="chart-group">
              {series.map(s => (
                <span key={s.key} className="chart-bar"
                      style={{ height: `${Math.max(0, r[s.key]) / max * 100}%`, background: s.color }} />
              ))}
            </span>
            <span className="chart-label">{t(`m.${r.month}` as 'm.1').slice(0, 3)}</span>
          </button>
        ))}
      </div>
      <figcaption className="legend">
        {series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </figcaption>
    </figure>
  )
}

export function YearView({ year, transactions, settings, today, onOpenMonth, onYear }: {
  year: number; transactions: Transaction[]; settings: Settings; today: string
  onOpenMonth: (ym: YearMonth) => void; onYear: (y: number) => void
}) {
  const { t, money, lang } = useI18n()
  const cur = settings.currency
  const y = useMemo(() => computeYear(year, transactions, settings, today), [year, transactions, settings, today])
  const years = useMemo(() => computeYears(transactions, settings, today), [transactions, settings, today])
  const cats = y.byCategory.filter(c => c.amount !== 0)

  return (
    <>
      <section className="card">
        <dl className="summary">
          {([['month.income', y.total.income], ['month.spent', y.total.spent], ['month.saved', y.total.saved],
             ['month.leftOver', y.total.leftOver]] as const).map(([k, v]) => (
            <div key={k}><dt>{t(k)}</dt><dd className={k === 'month.leftOver' && v < 0 ? 'bad-text' : ''}>{money(v, cur)}</dd></div>
          ))}
          <div><dt>{t('year.savingsRate')}</dt><dd>{pctFmt(y.total.savingsRate, lang)}</dd></div>
        </dl>
        <p className="muted small top-gap">{t('year.savingsRateHint')}</p>
        {!y.hasData && <p className="muted small">{t('year.empty')}</p>}
      </section>

      <section className="card">
        <h3 className="h-plain">{t('year.chart')}</h3>
        <YearChart rows={y.rows} currency={cur} onOpenMonth={m => onOpenMonth({ year, month: m })} />
        <p className="muted small">{t('year.tapMonth')}</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>{t('year.month')}</th><th>{t('month.income')}</th><th>{t('month.spent')}</th>
                  <th>{t('month.saved')}</th><th>{t('month.leftOver')}</th><th>{t('year.savingsRate')}</th></tr>
            </thead>
            <tbody>
              {y.rows.map(r => (
                <tr key={r.month}>
                  <th scope="row"><button className="link-btn" onClick={() => onOpenMonth({ year, month: r.month })}>
                    {t(`m.${r.month}` as 'm.1')}</button></th>
                  <td>{money(r.income, cur)}</td><td>{money(r.spent, cur)}</td><td>{money(r.saved, cur)}</td>
                  <td className={r.leftOver < 0 ? 'bad-text' : ''}>{money(r.leftOver, cur)}</td>
                  <td>{pctFmt(r.savingsRate, lang)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">{t('settings.total')}</th><td>{money(y.total.income, cur)}</td><td>{money(y.total.spent, cur)}</td>
                  <td>{money(y.total.saved, cur)}</td><td>{money(y.total.leftOver, cur)}</td><td>{pctFmt(y.total.savingsRate, lang)}</td></tr>
              <tr className="muted"><th scope="row">{t('year.average')}</th><td>{money(y.average.income, cur)}</td>
                  <td>{money(y.average.spent, cur)}</td><td>{money(y.average.saved, cur)}</td><td>{money(y.average.leftOver, cur)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="buckets">
        {y.buckets.map((b, i) => (
          <article key={b.bucket.id} className="card bucket">
            <div className="card-head">
              <h3><i style={{ background: BUCKET_COLORS[i] }} />{bucketName(b.bucket, t)}</h3>
            </div>
            <dl className="mini four">
              <div><dt>{t('year.startOfYear')}</dt><dd>{money(b.startOfYear, cur)}</dd></div>
              <div><dt>{t('bucket.fromIncome')}</dt><dd>{money(b.fromIncome, cur)}</dd></div>
              <div><dt>{t('bucket.spent')}</dt><dd>{money(b.spent, cur)}</dd></div>
              <div><dt>{t('year.endOfYear')}</dt><dd className={b.endOfYear < 0 ? 'bad-text' : ''}><strong>{money(b.endOfYear, cur)}</strong></dd></div>
            </dl>
          </article>
        ))}
      </section>

      {cats.length > 0 && (
        <section className="card">
          <h3 className="h-plain">{t('year.byCategory')}</h3>
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

      <section className="card">
        <h3 className="h-plain">{t('year.overYears')}</h3>
        <p className="muted small">{t('year.overYearsHint')}</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>{t('year.year')}</th><th>{t('month.income')}</th><th>{t('month.spent')}</th><th>{t('month.saved')}</th>
                  <th>{t('year.savingsRate')}</th><th>{t('year.endBalance')}</th></tr>
            </thead>
            <tbody>
              {years.map(r => (
                <tr key={r.year} className={r.year === year ? 'on' : ''}>
                  <th scope="row"><button className="link-btn" onClick={() => onYear(r.year)}>{r.year}</button></th>
                  <td>{money(r.income, cur)}</td><td>{money(r.spent, cur)}</td><td>{money(r.saved, cur)}</td>
                  <td>{pctFmt(r.savingsRate, lang)}</td>
                  <td className={r.endBalance < 0 ? 'bad-text' : ''}>{money(r.endBalance, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
