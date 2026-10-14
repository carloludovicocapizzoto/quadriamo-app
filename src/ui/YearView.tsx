import { useMemo } from 'react'
import { computeYear, computeYears, type MonthResult, type Settings, type Transaction, type YearMonth } from '../engine'
import { useI18n } from '../i18n/core'
import { ByCategory } from './ByCategory'
import { Icon } from './Icon'
import { Money } from './kit/Money'
import { BUCKET_COLORS, bucketName } from './names'
import { Outcome } from './Outcome'
import { Empty } from './kit/Empty'
import { ProGate } from './Pro'
import { CategoryChangesReport } from './Reports'

const pctFmt = (n: number | null, lang: string) =>
  n == null ? '—' : new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }).format(n)

export function YearNav({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const { t } = useI18n()
  return (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => onChange(year - 1)} aria-label={t('year.prev')}><Icon name="back" size={20} /></button>
      <h2>{year}</h2>
      <button className="icon-btn" onClick={() => onChange(year + 1)} aria-label={t('year.next')}><Icon name="chevron" size={20} /></button>
    </div>
  )
}

/** Barre mese per mese: entrate (chiare) e spese (inchiostro). Tocco su un mese = apri quel mese. */
function YearChart({ rows, onOpenMonth }: { rows: { month: number; income: number; spent: number }[]; onOpenMonth: (m: number) => void }) {
  const { t } = useI18n()
  const max = Math.max(1, ...rows.flatMap(r => [r.income, r.spent]))
  return (
    <figure className="ychart">
      <div className="ychart-bars">
        {rows.map(r => (
          <button key={r.month} className="ychart-month" onClick={() => onOpenMonth(r.month)} aria-label={t(`m.${r.month}` as 'm.1')}>
            <span className="ychart-pair">
              <span className="in" style={{ transform: `scaleY(${Math.max(0, r.income) / max})` }} />
              <span className="out" style={{ transform: `scaleY(${Math.max(0, r.spent) / max})` }} />
            </span>
            <span className="ychart-label">{t(`m.${r.month}` as 'm.1').slice(0, 1)}</span>
          </button>
        ))}
      </div>
      <figcaption className="hc-legend-line small muted"><i className="lg-bar" /> {t('month.income')} · <i className="lg-ink" /> {t('month.spent')}</figcaption>
    </figure>
  )
}

/**
 * L'anno, come il mese: quanto è avanzato (il protagonista), mese per mese, le quattro parti a fine anno,
 * cosa sta cambiando (anno in corso), dove sono andati i soldi e, se ci sono più anni, anno per anno.
 */
export function YearView({ year, transactions, settings, today, current, onOpenMonth, onYear }: {
  year: number; transactions: Transaction[]; settings: Settings; today: string; current: MonthResult
  onOpenMonth: (ym: YearMonth) => void; onYear: (y: number) => void
}) {
  const { t, money, lang } = useI18n()
  const cur = settings.currency
  const y = useMemo(() => computeYear(year, transactions, settings, today), [year, transactions, settings, today])
  const years = useMemo(() => computeYears(transactions, settings, today), [transactions, settings, today])
  const months = y.rows.filter(r => r.income || r.spent || r.saved)
  const left = y.total.leftOver
  if (!y.hasData) return <Empty title={t('year.emptyTitle', { year })} text={t('year.emptyText')} />

  return (
    <>
      <Outcome value={left} currency={cur} label={t(left < 0 ? 'year.overLabel' : 'year.leftLabel', { year })}
        totals={[{ label: t('month.income'), value: y.total.income }, { label: t('month.spent'), value: y.total.spent },
                 { label: t('ana.saved'), value: y.total.saved }, { label: t('year.savingsRate'), value: pctFmt(y.total.savingsRate, lang) }]}>
      </Outcome>

      {months.length > 0 && <>
        <h2 className="sec-title">{t('year.chart')}</h2>
        <YearChart rows={y.rows} onOpenMonth={m => onOpenMonth({ year, month: m })} />
        <ul className="group-list year-months">
          {months.map(r => (
            <li key={r.month}><button className="row" onClick={() => onOpenMonth({ year, month: r.month })}>
              <span className="row-main"><span>{t(`m.${r.month}` as 'm.1')}</span>
                <small>{t('year.monthSub', { spent: money(r.spent, cur) })}</small></span>
              <Money className={`row-value${r.leftOver < 0 ? ' bad-text' : ''}`} value={r.leftOver} currency={cur} />
              <Icon name="chevron" size={18} className="row-chev" />
            </button></li>
          ))}
        </ul>
      </>}

      <h2 className="sec-title">{t('ana.parts')}</h2>
      <ul className="part-rows">
        {y.buckets.map((b, i) => {
          const total = b.startOfYear + b.fromIncome
          const rest = total > 0 ? Math.max(0, Math.min(1, b.endOfYear / total)) : 0
          return (
            <li key={b.bucket.id}><div className="part-row" style={{ ['--bc' as string]: BUCKET_COLORS[i] }}>
              <span className={`part-block${b.endOfYear < 0 ? ' over' : ''}`} aria-hidden="true"><span style={{ transform: `scaleY(${rest})` }} /></span>
              <span className="part-main"><span>{bucketName(b.bucket, t)}</span>
                <small>{t('year.partSub', { in: money(b.fromIncome, cur), spent: money(b.spent, cur) })}</small></span>
              <Money className={`part-left${b.endOfYear < 0 ? ' bad' : ''}`} value={b.endOfYear} currency={cur} />
            </div></li>
          )
        })}
      </ul>

      {year === current.ym.year && <>
        <h2 className="sec-title">{t('year.changes')}</h2>
        <ProGate feature="reports"><CategoryChangesReport r={current} txs={transactions} settings={settings} today={today} /></ProGate>
      </>}

      {y.byCategory.some(c => c.amount !== 0) && <>
        <h2 className="sec-title">{t('year.byCategory')}</h2>
        <ByCategory rows={y.byCategory} currency={cur} />
      </>}

      {years.length > 1 && <>
        <h2 className="sec-title">{t('year.overYears')}</h2>
        <ul className="group-list">
          {years.map(r => (
            <li key={r.year}><button className={`row${r.year === year ? ' current' : ''}`} onClick={() => onYear(r.year)}>
              <span className="row-main"><span>{r.year}</span>
                <small>{t('year.savingsRate')} {pctFmt(r.savingsRate, lang)}</small></span>
              <Money className={`row-value${r.endBalance < 0 ? ' bad-text' : ''}`} value={r.endBalance} currency={cur} />
            </button></li>
          ))}
        </ul>
        <p className="group-foot">{t('year.overYearsHint')}</p>
      </>}
    </>
  )
}
