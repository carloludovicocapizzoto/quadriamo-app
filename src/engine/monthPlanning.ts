// Planning is deliberately independent of the cash/budget engine approved in #19.
import { allocate } from './month'
import { minorDigits } from './bankNumbers'
import { ymKey } from './dates'
import { safeToSpend } from './spend'
import type { Bucket, MonthResult, Settings } from './types'
export function monthPlanning(r: MonthResult, s: Settings, today: string) {
  const n = s.expectedIncome
  if (n == null || !Number.isFinite(n) || n <= 0 || (s.expectedFrom && (!/^\d{4}-\d{2}$/.test(s.expectedFrom) || ymKey(r.ym) < s.expectedFrom))) return null
  const real = safeToSpend(r, s, today)
  if (!real.length) return null
  const base = n - r.paidFirst
  const parts = allocate(Math.max(0, base), s.buckets.map(b => b.share), minorDigits(s.currency))
  if (parts.length) parts[0] += Math.min(0, base)
  const planned = safeToSpend({ ...r, buckets: r.buckets.map(b => ({ ...b, remaining: b.remaining - b.fromIncome + (parts[s.buckets.findIndex(x => x.id === b.bucket.id)] ?? 0) })) }, s, today)
  return { expected: n, received: r.income, missing: Math.max(0, n - r.income), extra: Math.max(0, r.income - n), actualDaily: real.reduce((a,b)=>a+b.perDay,0), plannedDaily: planned.reduce((a,b)=>a+b.perDay,0) }
}
export function splitOpeningBalance(buckets: Bucket[], amount: number, currency: string): Bucket[] {
  const parts = allocate(amount, buckets.map(b=>b.share), minorDigits(currency))
  return buckets.map((b,i)=>({...b,startingBalance:parts[i]}))
}
