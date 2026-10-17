// Riepilogo annuale (come il foglio Year Overview dell'Excel), senza limite di anni:
// i saldi dei bucket continuano da un anno all'altro.
import { computeMonth, monthCache } from './month'
import { parseDate } from './dates'
import type { Bucket, Category, MonthResult, Settings, Transaction } from './types'

export interface YearRow {
  month: number
  income: number
  spent: number
  saved: number
  leftOver: number
  savingsRate: number | null   // solo quanto messo da parte ÷ entrate (non quello non speso)
}

export interface YearBucket {
  bucket: Bucket
  startOfYear: number          // riportato a gennaio
  fromIncome: number
  spent: number
  endOfYear: number            // rimanenza a dicembre
}

type Totals = { income: number; spent: number; saved: number; leftOver: number; savingsRate: number | null }

const rate = (saved: number, income: number) => (income ? saved / income : null)

export function computeYear(year: number, all: Transaction[], s: Settings, today: string,
                            cache: Map<string, MonthResult> = monthCache(all, s, today)) {
  const months = Array.from({ length: 12 }, (_, i) => computeMonth({ year, month: i + 1 }, all, s, today, undefined, cache))
  const rows: YearRow[] = months.map(m => ({
    month: m.ym.month, income: m.income, spent: m.spent, saved: m.saved, leftOver: m.leftOver,
    savingsRate: rate(m.saved, m.income),
  }))
  const sum = (k: 'income' | 'spent' | 'saved' | 'leftOver') => rows.reduce((a, r) => a + r[k], 0)
  const total: Totals = { income: sum('income'), spent: sum('spent'), saved: sum('saved'), leftOver: sum('leftOver'),
                          savingsRate: rate(sum('saved'), sum('income')) }
  const withIncome = rows.filter(r => r.income !== 0)
  const avg = (k: 'income' | 'spent' | 'saved' | 'leftOver') =>
    withIncome.length ? withIncome.reduce((a, r) => a + r[k], 0) / withIncome.length : 0

  const catTotals = new Map<string, { category: Category; amount: number }>()
  for (const m of months) for (const c of m.byCategory) {
    const prev = catTotals.get(c.category.id)
    catTotals.set(c.category.id, { category: c.category, amount: (prev?.amount ?? 0) + c.amount })
  }
  const catSum = [...catTotals.values()].reduce((a, c) => a + c.amount, 0)
  const byCategory = [...catTotals.values()]
    .map(c => ({ ...c, share: catSum ? c.amount / catSum : 0 }))
    .sort((a, b) => b.amount - a.amount)

  const buckets: YearBucket[] = s.buckets.map((b, i) => ({
    bucket: b,
    startOfYear: months[0].buckets[i].carriedOver,
    fromIncome: months.reduce((a, m) => a + m.buckets[i].fromIncome, 0),
    spent: months.reduce((a, m) => a + m.buckets[i].spent, 0),
    endOfYear: months[11].buckets[i].remaining,
  }))

  return {
    year, rows, months, total, byCategory, buckets,
    average: { income: avg('income'), spent: avg('spent'), saved: avg('saved'), leftOver: avg('leftOver') },
    hasData: months.some(m => m.transactions.length > 0),
  }
}

/** Anni da mostrare: dal primo mese tracciato all'anno più recente tra oggi e i movimenti. */
export function yearsRange(all: Transaction[], s: Settings, today: string): number[] {
  let last = parseDate(today).year
  for (const t of all) if (t.date) last = Math.max(last, parseDate(t.date).year)
  const first = Math.min(s.firstMonth.year, last)
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

/** Confronto tra gli anni (totali e saldo complessivo dei bucket a fine anno). */
export function computeYears(all: Transaction[], s: Settings, today: string) {
  const cache = monthCache(all, s, today)
  return yearsRange(all, s, today).map(year => {
    const y = computeYear(year, all, s, today, cache)
    return { year, ...y.total, endBalance: y.buckets.reduce((a, b) => a + b.endOfYear, 0), hasData: y.hasData }
  })
}
