import { computeMonth } from './month'
import type { MonthResult, Settings, Transaction } from './types'

export interface YearRow {
  month: number
  income: number
  spent: number
  saved: number
  leftOver: number
  savingsRate: number | null   // solo quanto messo da parte ÷ entrate (non quello non speso)
}

export function computeYear(year: number, all: Transaction[], s: Settings, today: string) {
  const cache = new Map<string, MonthResult>()
  const months = Array.from({ length: 12 }, (_, i) => computeMonth({ year, month: i + 1 }, all, s, today, undefined, cache))
  const rows: YearRow[] = months.map(m => ({
    month: m.ym.month, income: m.income, spent: m.spent, saved: m.saved, leftOver: m.leftOver,
    savingsRate: m.income ? m.saved / m.income : null,
  }))
  const total = rows.reduce((a, r) => ({ income: a.income + r.income, spent: a.spent + r.spent,
                                         saved: a.saved + r.saved, leftOver: a.leftOver + r.leftOver }),
                            { income: 0, spent: 0, saved: 0, leftOver: 0 })
  const withIncome = rows.filter(r => r.income !== 0)
  const avg = (k: 'income' | 'spent' | 'saved' | 'leftOver') =>
    withIncome.length ? withIncome.reduce((a, r) => a + r[k], 0) / withIncome.length : 0
  return {
    rows, months,
    total: { ...total, savingsRate: total.income ? total.saved / total.income : null },
    average: { income: avg('income'), spent: avg('spent'), saved: avg('saved'), leftOver: avg('leftOver') },
  }
}
