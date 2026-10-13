import { useMemo } from 'react'
import { categoryChanges, type MonthResult, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { categoryName } from './names'

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
