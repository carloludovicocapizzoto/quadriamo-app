// "Quanto posso spendere oggi" e piano del giorno di paga: le due funzioni che rispondono alla domanda vera.
import { daysBetween } from './dates'
import type { MonthResult, Settings } from './types'

export interface SafeToSpend {
  bucketId: string
  remaining: number        // quanto resta nel bucket
  reserved: number         // pagamenti ricorrenti ancora in arrivo nel mese (già "impegnati")
  free: number             // remaining - reserved
  daysLeft: number         // giorni rimasti nel periodo, oggi compreso
  perDay: number           // quanto si può spendere al giorno da oggi alla fine del periodo
}

/** Solo per i bucket "di spesa" (quelli che hanno categorie di spesa) e solo se oggi è dentro il periodo. */
export function safeToSpend(r: MonthResult, s: Settings, today: string): SafeToSpend[] {
  if (today < r.period.start || today > r.period.end) return []
  const daysLeft = daysBetween(today, r.period.end) + 1
  const spending = new Set(s.categories.filter(c => c.type === 'expense' && c.defaultBucket).map(c => c.defaultBucket!))
  return r.buckets.filter(b => spending.has(b.bucket.id)).map(b => {
    const reserved = r.transactions
      .filter(t => t.upcoming && t.bucket === b.bucket.id)
      .reduce((a, t) => a + (t.planned ?? 0), 0)
    const free = b.remaining - reserved
    return { bucketId: b.bucket.id, remaining: b.remaining, reserved, free, daysLeft, perDay: Math.max(0, free) / daysLeft }
  })
}

/** Quanto spostare in ogni pocket con le entrate del mese (secondo la regola e le entrate assegnate a un bucket). */
export function paydayPlan(r: MonthResult): { bucketId: string; amount: number }[] {
  return r.buckets.filter(b => b.fromIncome > 0.004).map(b => ({ bucketId: b.bucket.id, amount: Math.round(b.fromIncome * 100) / 100 }))
}
