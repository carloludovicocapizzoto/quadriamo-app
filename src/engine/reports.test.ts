import { describe, expect, it } from 'vitest'
import { categoryChanges, computeMonth, defaultSettings, forecastMonth, monthlyTrend, type Transaction } from '.'

const s = defaultSettings({ currency: 'EUR', firstMonth: { year: 2026, month: 8 } })
const cat = (type: string) => s.categories.find(c => c.type === type)!.id
const exp = s.categories.filter(c => c.type === 'expense')
const tx = (id: string, date: string, amount: number, category: string): Transaction =>
  ({ id, date, amount, category, description: id, currency: null, paidFrom: null }) as unknown as Transaction
const txs: Transaction[] = [
  tx('s8', '2026-08-01', 1500, cat('income')), tx('s9', '2026-09-01', 1500, cat('income')), tx('s10', '2026-10-01', 1500, cat('income')),
  tx('a8', '2026-08-10', 100, exp[1].id), tx('a9', '2026-09-10', 100, exp[1].id), tx('a10', '2026-10-05', 250, exp[1].id),
  tx('b10', '2026-10-03', 50, exp[2].id),
]

describe('report', () => {
  it('andamento: un punto per mese dal primo mese', () => {
    const t = monthlyTrend({ year: 2026, month: 10 }, 6, txs, s, '2026-10-10')
    expect(t.map(p => p.ym.month)).toEqual([8, 9, 10])
    expect(t[0].income).toBe(1500)
  })
  it('categorie che crescono: confronto con la media dei mesi prima', () => {
    const c = categoryChanges({ year: 2026, month: 10 }, txs, s, '2026-10-10')
    expect(c[0]).toMatchObject({ now: 250, before: 100, diff: 150, pct: 150 })
    expect(c.find(x => x.category.id === exp[2].id)).toMatchObject({ before: 0, pct: null })
  })
  it('previsione: ritmo delle spese variabili per i giorni che restano', () => {
    const r = computeMonth({ year: 2026, month: 10 }, txs, s, '2026-10-10')
    const f = forecastMonth(r, '2026-10-10')!
    expect(f.spentSoFar).toBeGreaterThanOrEqual(300)
    expect(f.daysLeft).toBe(21)
    expect(f.projected).toBeGreaterThan(f.spentSoFar)
  })
})
