import { describe, expect, it } from 'vitest'
import { dailySpending } from './daily'
import type { MonthResult } from './types'

const tx = (date: string, amountIn: number, type: 'expense' | 'income' = 'expense', upcoming = false) =>
  ({ id: date + amountIn, date, description: '', category: 'x', amount: amountIn, type, bucket: 'b', amountIn, upcoming })

describe('dailySpending', () => {
  it('somma le uscite per giorno e accumula; ignora entrate e ricorrenti in arrivo', () => {
    const r = { period: { start: '2026-10-01', end: '2026-10-05' },
      transactions: [tx('2026-10-01', 10), tx('2026-10-01', 5), tx('2026-10-02', 100, 'income'), tx('2026-10-03', 20), tx('2026-10-05', 50, 'expense', true)] } as unknown as MonthResult
    const d = dailySpending(r)
    expect(d).toHaveLength(5)
    expect(d.map(x => x.spent)).toEqual([15, 0, 20, 0, 0])
    expect(d.at(-1)!.cumulative).toBe(35)
  })
})
