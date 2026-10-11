// Spese giorno per giorno nel periodo del mese (per il grafico della home): uscite reali, non quelle in arrivo.
import { addDays, daysBetween } from './dates'
import type { MonthResult } from './types'

export interface DayPoint { day: string; spent: number; cumulative: number }

export function dailySpending(r: MonthResult): DayPoint[] {
  const n = daysBetween(r.period.start, r.period.end) + 1
  const byDay = new Map<string, number>()
  for (const t of r.transactions) {
    if (t.type !== 'expense' || t.upcoming || !t.date || t.amountIn == null) continue
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amountIn)
  }
  let cum = 0
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(r.period.start, i)
    const spent = byDay.get(day) ?? 0
    cum += spent
    return { day, spent, cumulative: Math.round(cum * 100) / 100 }
  })
}
