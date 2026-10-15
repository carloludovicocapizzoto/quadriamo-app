// Calcoli dei widget della Home: ultimi 7 giorni, mercati aperti o chiusi, missioni del giorno e della settimana.
// Funzioni pure: niente rete, niente dati che escono dal telefono.
import { addDays } from './dates'
import type { ClassifiedTx } from './types'

/** Spese degli ultimi `days` giorni (oggi compreso) e dei `days` prima, con la categoria più pesante. */
export function lastDays(txs: ClassifiedTx[], today: string, days = 7) {
  const from = addDays(today, -(days - 1)), prevFrom = addDays(today, -(2 * days - 1))
  const spent = (a: string, b: string) => txs.filter(x => x.type === 'expense' && !x.upcoming && x.date && x.date >= a && x.date <= b)
  const now = spent(from, today), before = spent(prevFrom, addDays(from, -1))
  const sum = (l: ClassifiedTx[]) => Math.round(l.reduce((a, x) => a + (x.amountIn ?? 0), 0) * 100) / 100
  const by = new Map<string, number>()
  for (const x of now) by.set(x.category ?? '', (by.get(x.category ?? '') ?? 0) + (x.amountIn ?? 0))
  const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0]
  return { spent: sum(now), before: sum(before), count: now.length, topCategory: top?.[0] || null, topAmount: top ? Math.round(top[1] * 100) / 100 : 0 }
}

// borse principali: fuso orario, apertura e chiusura in ora locale (minuti), lunedì-venerdì. Le festività non sono considerate.
export const MARKETS = [
  { id: 'milan', tz: 'Europe/Rome', open: 9 * 60, close: 17 * 60 + 30 },
  { id: 'frankfurt', tz: 'Europe/Berlin', open: 9 * 60, close: 17 * 60 + 30 },
  { id: 'london', tz: 'Europe/London', open: 8 * 60, close: 16 * 60 + 30 },
  { id: 'newyork', tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
] as const
export type MarketId = typeof MARKETS[number]['id']

/** Per ogni borsa: aperta o chiusa adesso, e l'ora (locale della borsa) della prossima apertura o chiusura. */
export function marketsNow(now: Date) {
  return MARKETS.map(m => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: m.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now).map(p => [p.type, p.value]))
    const mins = Number(parts.hour) * 60 + Number(parts.minute)
    const weekday = !['Sat', 'Sun'].includes(parts.weekday)
    const open = weekday && mins >= m.open && mins < m.close
    const at = open ? m.close : m.open
    // quando riapre: oggi (prima dell'apertura), domani, o lunedì (venerdì sera e fine settimana)
    const next = open ? null : weekday && mins < m.open ? 'today' : parts.weekday === 'Fri' || !weekday ? 'monday' : 'tomorrow'
    return { id: m.id as MarketId, open, at: `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`, today: weekday && mins < m.open, next }
  })
}

export type MissionId = 'log' | 'underDaily' | 'streak3' | 'save'
/** Missioni: piccole cose del giorno e della settimana, calcolate dai dati (niente da segnare a mano). */
export function missions(i: { loggedToday: boolean; spentToday: number; dailyAllowance: number; streak: number; savedThisWeek: boolean }) {
  return [
    { id: 'log' as MissionId, when: 'day' as const, done: i.loggedToday },
    { id: 'underDaily' as MissionId, when: 'day' as const, done: i.loggedToday && i.spentToday <= i.dailyAllowance },
    { id: 'streak3' as MissionId, when: 'week' as const, done: i.streak >= 3 },
    { id: 'save' as MissionId, when: 'week' as const, done: i.savedThisWeek },
  ]
}
