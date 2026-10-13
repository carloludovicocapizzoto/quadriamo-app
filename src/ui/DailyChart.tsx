import { useMemo, useState } from 'react'
import { dailySpending, type MonthResult, type Settings } from '../engine'
import { useI18n } from '../i18n/core'

/** Spese giorno per giorno con il totale da inizio mese: tocca (o passa sopra) un giorno per i dettagli. */
export function DailyChart({ r, settings, today }: { r: MonthResult; settings: Settings; today: string }) {
  const { t, money, date } = useI18n()
  const cur = settings.currency
  const days = useMemo(() => dailySpending(r), [r])
  const maxDay = Math.max(1, ...days.map(d => d.spent))
  const maxCum = Math.max(1, days.at(-1)?.cumulative ?? 0)
  const todayIdx = days.findIndex(d => d.day === today)
  const [day, setDay] = useState<number | null>(null)
  const shown = day ?? (todayIdx >= 0 ? todayIdx : days.length - 1)
  const line = days.map((d, i) => `${i + 0.5},${100 - (d.cumulative / maxCum) * 92}`).join(' ')
  const anySpend = days.some(d => d.spent > 0)
  if (!anySpend) return <p className="muted small">{t('home.noSpend')}</p>
  return (
    <>
        <p className="hc-tip" aria-live="polite">{t('home.dayTip', { date: date(days[shown].day, { day: 'numeric', month: 'short' }),
          amount: money(days[shown].spent, cur), total: money(days[shown].cumulative, cur) })}</p>
        <div className="hc-bars" role="img" aria-label={t('home.daily')} onMouseLeave={() => setDay(null)}>
          <svg className="hc-line" viewBox={`0 0 ${days.length} 100`} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={line} />
          </svg>
          {days.map((d, i) => (
            <button key={d.day} type="button" className={`col${i === shown ? ' on' : ''}${i === todayIdx ? ' today' : ''}`}
                    aria-label={date(d.day, { day: 'numeric', month: 'short' })} onClick={() => setDay(i)} onMouseEnter={() => setDay(i)}>
              {d.spent > 0 && <span className="bar" style={{ height: `${Math.max(3, (d.spent / maxDay) * 92)}%` }} />}
            </button>
          ))}
        </div>
        <p className="hc-legend-line small muted"><i className="lg-bar" /> {t('home.legendDay')} · <i className="lg-line" /> {t('home.legendCum')}</p>
    </>
  )
}
