// "Quanto posso spendere oggi" e piano del giorno di paga: le due funzioni che rispondono alla domanda vera.
import { daysBetween, ymKey } from './dates'
import type { Bucket, MonthResult, Settings } from './types'

export interface SafeToSpend {
  bucketId: string
  remaining: number        // quanto resta nel bucket
  reserved: number         // pagamenti ricorrenti ancora in arrivo nel mese (già "impegnati")
  free: number             // remaining - reserved
  daysLeft: number         // giorni rimasti nel periodo, oggi compreso
  perDay: number           // quanto si può spendere al giorno da oggi alla fine del periodo
}

/**
 * Solo per i bucket "di spesa" (quelli che hanno categorie di spesa) e solo se oggi è dentro il periodo.
 * Con il reddito previsto (settings.expectedIncome) il numero del giorno si calcola su quello che si prende di norma,
 * diviso con la regola dopo le spese «prima delle parti», al posto delle entrate registrate: arrivi in ritardo non lo
 * abbassano, e quello che arriva oltre il previsto è un extra che resta nelle parti ma non alza il numero del giorno.
 */
export function safeToSpend(r: MonthResult, s: Settings, today: string): SafeToSpend[] {
  if (today < r.period.start || today > r.period.end) return []
  const daysLeft = daysBetween(today, r.period.end) + 1
  const expected = expectedFor(r, s)
  const spending = new Set(s.categories.filter(c => c.type === 'expense' && c.defaultBucket).map(c => c.defaultBucket!))
  return r.buckets.filter(b => spending.has(b.bucket.id)).map(b => {
    const reserved = r.transactions
      .filter(t => t.upcoming && t.bucket === b.bucket.id)
      .reduce((a, t) => a + (t.planned ?? 0), 0)
    const i = s.buckets.findIndex(x => x.id === b.bucket.id)
    const remaining = expected == null ? b.remaining : b.remaining - b.fromIncome + ruleShare(s, expected - r.paidFirst, i)
    const free = remaining - reserved
    return { bucketId: b.bucket.id, remaining, reserved, free, daysLeft, perDay: Math.max(0, free) / daysLeft }
  })
}

/** La quota di una parte quando `base` si divide con la regola: un ammanco (base negativa) pesa sulla prima parte, come in computeMonth. */
const ruleShare = (s: Settings, base: number, i: number) => Math.max(0, base) * (s.buckets[i]?.share ?? 0) + (i === 0 ? Math.min(0, base) : 0)

/** Il reddito previsto vale per il periodo `r`? (C'è, ed è dal periodo in cui vale in poi.) */
export function expectedFor(r: MonthResult, s: Settings): number | null {
  const n = s.expectedIncome
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return !s.expectedFrom || ymKey(r.ym) >= s.expectedFrom ? n : null
}

export interface MonthBudget {
  expected: number         // reddito previsto del mese: è la base del numero del giorno
  received: number         // entrate arrivate nel periodo (stipendio ed extra)
  missing: number          // quanto deve ancora arrivare per fare il previsto
  extra: number            // entrate oltre il previsto: restano dove le ha messe l'utente, fuori dal numero del giorno
  fixed: number            // spese fisse del periodo (pagate, collegate o da pagare)
  daysLeft: number
  perDay: number           // il numero del giorno
  over: number             // quanto le spese hanno già superato il previsto nelle parti di spesa (un fatto, non una stima)
}

/** Il budget del mese sul reddito previsto: null senza reddito previsto per questo periodo o fuori dal periodo. */
export function monthBudget(r: MonthResult, s: Settings, today: string): MonthBudget | null {
  const expected = expectedFor(r, s)
  const safe = safeToSpend(r, s, today)
  if (expected == null || !safe.length) return null
  const fixed = r.transactions.reduce((a, t) => a + (t.recurring ? t.planned ?? 0 : t.occurrence && t.type === 'expense' ? t.amountIn ?? 0 : 0), 0)
  const free = safe.reduce((a, x) => a + x.free, 0)
  return {
    expected, received: round(r.income), missing: Math.max(0, round(expected - r.income)), extra: Math.max(0, round(r.income - expected)),
    fixed: round(fixed), daysLeft: safe[0].daysLeft, perDay: round(safe.reduce((a, x) => a + x.perDay, 0)), over: free < 0 ? round(-free) : 0,
  }
}

/**
 * Quanto le spese hanno già superato i soldi delle parti di spesa: un fatto, mai una proiezione. Con il reddito previsto
 * il confronto è col previsto (`planned`); senza, coi soldi che ci sono, spese fisse da pagare comprese. 0 se va tutto bene.
 */
export function overspent(r: MonthResult, s: Settings, today: string): { amount: number; planned: boolean } {
  const free = safeToSpend(r, s, today).reduce((x, b) => x + b.free, 0)
  return { amount: free < 0 ? round(-free) : 0, planned: expectedFor(r, s) != null }
}

/** Il saldo di partenza diviso con la regola, al centesimo: i centesimi che avanzano vanno alla prima parte. */
export function splitBalance(buckets: Bucket[], amount: number): Bucket[] {
  const cents = Math.round(amount * 100)
  const parts = buckets.map(b => Math.floor(cents * b.share))
  if (parts.length) parts[0] += cents - parts.reduce((a, x) => a + x, 0)
  return buckets.map((b, i) => ({ ...b, startingBalance: parts[i] / 100 }))
}

const round = (n: number) => Math.round(n * 100) / 100

/** Quanto spostare in ogni pocket con le entrate del mese (secondo la regola e le entrate assegnate a un bucket). */
export function paydayPlan(r: MonthResult): { bucketId: string; amount: number }[] {
  const rows = r.buckets.filter(b => b.fromIncome > 0).map((b, index) => {
    const cents = b.fromIncome * 100
    const whole = Math.floor(cents + 1e-8)
    return { bucketId: b.bucket.id, index, cents, whole, fraction: Math.round((cents - whole) * 1e8) / 1e8 }
  })
  const extra = Math.round(rows.reduce((sum, b) => sum + b.cents, 0)) - rows.reduce((sum, b) => sum + b.whole, 0)
  // I centesimi residui vanno alle frazioni più grandi, a parità nell'ordine delle parti.
  const ranked = [...rows].sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < extra; i++) ranked[i].whole++
  return rows.filter(b => b.whole > 0).map(b => ({ bucketId: b.bucketId, amount: b.whole / 100 }))
}
