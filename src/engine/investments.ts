import { addMonths, daysBetween } from './dates'
import type { Settings } from './types'

export interface Holding {
  name: string
  type?: string
  ticker?: string
  currency?: string | null     // valuta del titolo; vuota = la tua
  units: number | null
  avgPrice: number | null      // nella valuta del titolo
  livePrice?: number | null
  manualPrice?: number | null
}

/** Cambio verso la tua valuta: 1 se è la tua, null se manca in Settings. */
export function rateTo(currency: string | null | undefined, s: Settings): number | null {
  if (!currency || currency === s.currency) return 1
  return s.fxRates[currency] ?? null
}

export function valueHolding(h: Holding, s: Settings) {
  const price = h.manualPrice ?? h.livePrice ?? null
  const rate = rateTo(h.currency, s)
  const invested = h.units != null && h.avgPrice != null && rate != null ? h.units * h.avgPrice * rate : null
  const value = h.units != null && price != null && rate != null ? h.units * price * rate : null
  const gain = invested != null && value != null ? value - invested : null
  const ret = gain != null && invested ? gain / invested : null
  return { price, rate, invested, value, gain, return: ret, missingValue: h.units != null && value == null }
}

export interface Deposit { name: string; amount: number; yearlyRate: number; start: string; termMonths?: number | null }

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
