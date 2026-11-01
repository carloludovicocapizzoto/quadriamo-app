import { addMonths, daysBetween } from './dates'
import { fxRate } from './month'
import type { MonthResult, Settings } from './types'

export interface Holding {
  id: string
  name: string
  type?: string
  ticker?: string
  currency?: string | null     // valuta del titolo; vuota = la tua
  units: number | null
  avgPrice: number | null      // nella valuta del titolo
  livePrice?: number | null
  manualPrice?: number | null
}

/** Cambio verso la tua valuta: 1 se è la tua, null se manca. */
const rateTo = fxRate

export function valueHolding(h: Holding, s: Settings) {
  const price = h.manualPrice ?? h.livePrice ?? null
  const rate = rateTo(h.currency, s)
  const invested = h.units != null && h.avgPrice != null && rate != null ? h.units * h.avgPrice * rate : null
  const value = h.units != null && price != null && rate != null ? h.units * price * rate : null
  const gain = invested != null && value != null ? value - invested : null
  const ret = gain != null && invested ? gain / invested : null
  return { price, rate, invested, value, gain, return: ret, missingValue: h.units != null && value == null }
}

export interface Deposit { id: string; name: string; amount: number; yearlyRate: number; start: string; termMonths?: number | null }

/** Interesse lordo semplice maturato fino a oggi o alla scadenza. */
export function depositInterest(d: Deposit, today: string) {
  const maturity = d.termMonths ? addMonths(d.start, d.termMonths) : null
  const end = maturity && maturity < today ? maturity : today
  const interest = d.amount * d.yearlyRate * Math.max(0, daysBetween(d.start, end)) / 365
  return { interest, value: d.amount + interest, maturity }
}

/** Valore futuro di un PAC mensile (come FV di Excel con versamenti a fine mese). */
export function pacFutureValue(monthly: number, yearlyReturn: number, years: number): number {
  const i = yearlyReturn / 12, n = years * 12
  return i === 0 ? monthly * n : monthly * ((1 + i) ** n - 1) / i
}

export interface PacPlan { monthly: number; yearlyReturn: number; years: number }

export interface Investments {
  holdings: Holding[]
  deposits: Deposit[]
  pac: PacPlan
  portfolioValues: Record<string, number>   // "YYYY-MM" -> valore del portafoglio a fine mese (scritto dall'utente)
}

export const emptyInvestments = (): Investments => ({
  holdings: [], deposits: [], pac: { monthly: 100, yearlyReturn: 0.06, years: 10 }, portfolioValues: {},
})

export function portfolioSummary(inv: Investments, s: Settings, today: string) {
  const hs = inv.holdings.map(h => ({ holding: h, ...valueHolding(h, s) }))
  const ds = inv.deposits.map(d => ({ deposit: d, ...depositInterest(d, today) }))
  const invested = hs.some(h => h.invested == null) ? null
    : hs.reduce((a, h) => a + h.invested!, 0) + ds.reduce((a, d) => a + d.deposit.amount, 0)
  const missing = hs.filter(h => h.value == null).length
  const value = missing ? null : hs.reduce((a, h) => a + h.value!, 0) + ds.reduce((a, d) => a + d.value, 0)
  const gain = value != null && invested != null ? value - invested : null
  return { holdings: hs, deposits: ds, invested, value, gain,
           return: gain != null && invested ? gain / invested : null, missing }
}

/** Proiezione del PAC anno per anno: versato e valore atteso. */
export function pacProjection(p: PacPlan) {
  return Array.from({ length: Math.max(0, Math.round(p.years)) }, (_, i) => ({
    year: i + 1, putIn: p.monthly * 12 * (i + 1), value: pacFutureValue(p.monthly, p.yearlyReturn, i + 1),
  }))
}

/**
 * Piano contro realtà nell'anno: "investito" è quanto è uscito dal bucket Investimenti nei mesi
 * (come nell'Excel); il valore del portafoglio lo scrive l'utente a fine mese.
 */
export function pacTracker(months: MonthResult[], plan: PacPlan, values: Record<string, number>, bucketId = 'investments') {
  let total = 0
  return months.map(m => {
    const key = `${m.ym.year}-${String(m.ym.month).padStart(2, '0')}`
    const invested = m.buckets.find(b => b.bucket.id === bucketId)?.spent ?? 0
    total += invested
    const value = values[key]
    return { key, month: m.ym.month, planned: plan.monthly, invested, difference: invested ? invested - plan.monthly : null,
             totalInvested: invested ? total : null, value: value ?? null,
             gain: value != null && total ? value - total : null }
  })
}

/** Prezzo automatico di un titolo, tenuto solo sul dispositivo: `change` è la variazione nelle 24 ore (0.012 = +1,2%). */
export interface LiveQuote { price: number; change: number | null; at: string }
/** Ultimi prezzi scritti a mano, uno per giorno, il più recente per ultimo (al massimo due). */
export type PriceDays = { date: string; price: number }[]

/**
 * Ricorda il prezzo scritto a mano di oggi: nello stesso giorno l'ultimo vince (si scrive una cifra alla volta),
 * in un giorno nuovo si aggiunge solo se il prezzo è cambiato, così «dal» resta il giorno dell'ultimo cambiamento.
 */
export function recordPrice(days: PriceDays, today: string, price: number): PriceDays {
  const last = days[days.length - 1]
  if (last?.date === today) return last.price === price ? days : [...days.slice(0, -1), { date: today, price }]
  if (last?.price === price) return days
  return [...days, { date: today, price }].slice(-2)
}

/**
 * Quanto si è mosso un titolo, nella tua valuta: con il prezzo automatico nelle ultime 24 ore, con quello a mano
 * dall'ultimo prezzo diverso scritto in un altro giorno. Null se non c'è un prezzo di confronto.
 */
export function holdingMove(h: Holding, s: Settings, live?: LiveQuote | null, days?: PriceDays | null) {
  const rate = rateTo(h.currency, s)
  if (h.units == null || rate == null) return null
  let price: number, prev: number, since: string | null
  if (h.manualPrice != null) {
    const [before, now] = days ?? []
    if (!now || now.price !== h.manualPrice || !before?.price) return null
    price = now.price; prev = before.price; since = before.date
  } else if (live && live.change != null && live.change > -1) {
    price = live.price; prev = live.price / (1 + live.change); since = null
  } else return null
  return { amount: h.units * (price - prev) * rate, pct: price / prev - 1, since }
}

/** Movimento del portafoglio: somma dei titoli che hanno un confronto, in valore e in percentuale su quanto valevano prima. */
export function portfolioMove(inv: Investments, s: Settings, live: Record<string, LiveQuote>, days: Record<string, PriceDays>) {
  const moves = inv.holdings.map(h => ({ move: holdingMove(h, s, live[h.id], days[h.id]), value: valueHolding(withLive(h, live), s).value }))
    .filter(x => x.move && x.value != null)
  if (!moves.length) return null
  const amount = moves.reduce((a, x) => a + x.move!.amount, 0)
  const before = moves.reduce((a, x) => a + x.value!, 0) - amount
  const sinces = moves.map(x => x.move!.since)
  return { amount, pct: before > 0 ? amount / before : null, count: moves.length,
           // tutti nelle 24 ore, o il giorno più vecchio da cui si confronta
           since: sinces.every(x => x == null) ? null : sinces.filter((x): x is string => x != null).sort()[0] }
}

/** Il titolo con il prezzo automatico del dispositivo, per i calcoli di sempre (il prezzo a mano continua a vincere). */
export const withLive = (h: Holding, live: Record<string, LiveQuote>): Holding => live[h.id] ? { ...h, livePrice: live[h.id].price } : h
export const investmentsWithLive = (inv: Investments, live: Record<string, LiveQuote>): Investments =>
  ({ ...inv, holdings: inv.holdings.map(h => withLive(h, live)) })
