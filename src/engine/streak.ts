// Slancio (come la "serie" di Duolingo): giorni di fila in cui hai aggiornato Quadriamo — un movimento aggiunto o
// modificato, oppure "oggi niente spese". Resta vivo fino a fine giornata: se ieri c'eri e oggi non ancora, è "a rischio".
import { addDays } from './dates'

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]

export interface Streak {
  count: number         // giorni di fila (fino a oggi, o fino a ieri se oggi non ancora)
  doneToday: boolean
  atRisk: boolean       // c'è uno slancio ma oggi manca ancora l'aggiornamento
  best: number          // record
  week: boolean[]       // gli ultimi 7 giorni, oggi per ultimo
}

export function streakOf(days: readonly string[], today: string): Streak {
  const set = new Set(days)
  const doneToday = set.has(today)
  let count = 0
  for (let d = doneToday ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) count++
  let best = 0, run = 0, prev = ''
  for (const d of [...set].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run); prev = d
  }
  const week = Array.from({ length: 7 }, (_, i) => set.has(addDays(today, i - 6)))
  return { count, doneToday, atRisk: count > 0 && !doneToday, best, week }
}

/** Aggiunge un giorno all'elenco (ordinato, senza doppioni, al massimo ~400 giorni). */
export function withDay(days: readonly string[] | undefined, day: string): string[] {
  if (days?.includes(day)) return [...days]
  return [...(days ?? []), day].sort().slice(-400)
}
