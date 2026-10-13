import { useMemo } from 'react'
import { categoryChanges, monthlyTrend, type MonthResult, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { categoryName } from './names'

/** Entrate e spese degli ultimi sei mesi. */
export function TrendReport({ r, txs, settings, today }: { r: MonthResult; txs: Transaction[]; settings: Settings; today: string }) {
  const { t, money } = useI18n()
  const pts = useMemo(() => monthlyTrend(r.ym, 6, txs, settings, today), [r.ym, txs, settings, today])
  const max = Math.max(1, ...pts.flatMap(p => [p.income, p.spent]))
  const done = pts.filter(p => p.ym.year * 12 + p.ym.month < r.ym.year * 12 + r.ym.month)
  const avg = done.length ? done.reduce((a, p) => a + p.spent, 0) / done.length : null
  const short = (m: number) => t(`m.${m}` as keyof Dict).slice(0, 3)
  return <>
    <div className="trend" role="img" aria-label={t('w.trend')}>
      {pts.map(p => (
        <div key={`${p.ym.year}-${p.ym.month}`} className="trend-col" title={`${t(`m.${p.ym.month}` as keyof Dict)}: ${money(p.spent, settings.currency)}`}>
          <div className="trend-bars">
            <span className="tb-in" style={{ height: `${(p.income / max) * 100}%` }} />
            <span className="tb-out" style={{ height: `${(p.spent / max) * 100}%` }} />
          </div>
          <small>{short(p.ym.month)}</small>
        </div>
      ))}
    </div>
    <p className="legend small muted"><i className="tb-in" />{t('month.income')} <i className="tb-out" />{t('month.spent')}</p>
    {avg != null && <p className="muted small">{t('rep.avgSpent', { amount: money(avg, settings.currency) })}</p>}
  </>
}

/** Categorie che crescono (e calano) rispetto alla media dei mesi prima. */
export function CategoryChangesReport({ r, txs, settings, today }: { r: MonthResult; txs: Transaction[]; settings: Settings; today: string }) {
  const { t, money } = useI18n()
  const list = useMemo(() => categoryChanges(r.ym, txs, settings, today).filter(c => Math.abs(c.diff) >= 1).slice(0, 5),
    [r.ym, txs, settings, today])
  if (!list.length) return <p className="muted small">{t('rep.noHistory')}</p>
  return <>
    <ul className="changes">
      {list.map(c => (
        <li key={c.category.id}>
          <span>{categoryName(c.category, t)}<small className="muted">{t('rep.was', { amount: money(c.before, settings.currency) })}</small></span>
          <b className={c.diff > 0 ? 'bad-text' : 'good-text'}>{c.diff > 0 ? '+' : '−'}{money(Math.abs(c.diff), settings.currency)}
            <small>{c.pct == null ? t('rep.new') : `${c.diff > 0 ? '+' : ''}${c.pct}%`}</small></b>
        </li>
      ))}
    </ul>
    <p className="muted small">{t('rep.vsAvg')}</p>
  </>
}
