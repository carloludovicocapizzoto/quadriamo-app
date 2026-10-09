import type { YearMonth } from '../engine'
import { useI18n } from '../i18n/core'

export function MonthNav({ ym, onChange }: { ym: YearMonth; onChange: (ym: YearMonth) => void }) {
  const { t } = useI18n()
  const shift = (d: number) => {
    const m = ym.month - 1 + d
    onChange({ year: ym.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 })
  }
  return (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => shift(-1)} aria-label={t('month.prev')}>‹</button>
      <h2>{t(`m.${ym.month}` as 'm.1')} {ym.year}</h2>
      <button className="icon-btn" onClick={() => shift(1)} aria-label={t('month.next')}>›</button>
    </div>
  )
}
