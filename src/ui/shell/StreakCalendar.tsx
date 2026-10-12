import { addDays } from '../../engine'
import { useI18n } from '../../i18n/core'

/** Calendario del mese con i giorni in cui hai aggiornato Quadriamo (come il calendario della serie di Duolingo). */
export function StreakCalendar({ days, today }: { days: readonly string[]; today: string }) {
  const { lang } = useI18n()
  const set = new Set(days)
  const first = `${today.slice(0, 8)}01`
  const offset = (new Date(`${first}T12:00:00`).getDay() + 6) % 7          // lunedì = 0
  const total = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()
  const names = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)))
  const cells = Array.from({ length: offset + total }, (_, i) => i < offset ? null : addDays(first, i - offset))
  return (
    <div className="cal">
      <p className="cal-title">{new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date(`${first}T12:00:00`))}</p>
      <div className="cal-grid">
        {names.map((n, i) => <span key={`n${i}`} className="cal-h">{n}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const on = set.has(d), prev = set.has(addDays(d, -1)), next = set.has(addDays(d, 1))
          return <span key={d} className={`cal-d${on ? ' on' : ''}${on && prev ? ' l' : ''}${on && next ? ' r' : ''}${d === today ? ' today' : ''}${d > today ? ' future' : ''}`}>
            {Number(d.slice(8))}</span>
        })}
      </div>
    </div>
  )
}
