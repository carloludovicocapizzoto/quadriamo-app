import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { monthReceipt } from './receipt'
import type { Transaction } from './types'

const s = defaultSettings({ firstMonth: { year: 2026, month: 8 } })
let n = 0
const tx = (date: string, description: string, category: string, amount: number): Transaction => ({ id: String(++n), date, description, category, amount })
const txs = [
  tx('2026-08-01', 'Stipendio', 'salary', 1500), tx('2026-08-05', 'Spesa', 'groceries', 100), tx('2026-08-20', 'Cena', 'eatingOut', 60),
  tx('2026-09-01', 'Stipendio', 'salary', 1500), tx('2026-09-03', 'Spesa', 'groceries', 120), tx('2026-09-03', 'Caffè', 'eatingOut', 1.5),
  tx('2026-09-04', 'Caffè', 'eatingOut', 1.5), tx('2026-09-05', 'Caffè', 'eatingOut', 1.5), tx('2026-09-06', 'Caffè', 'eatingOut', 1.5),
  tx('2026-09-07', 'Caffè', 'eatingOut', 1.5), tx('2026-09-10', 'Scarpe', 'funShopping', 90), tx('2026-09-25', 'PAC', 'investmentsSaving', 100),
  tx('2026-09-26', 'Fondo', 'safetyFundSaving', 50),
]

describe('ricevuta del mese', () => {
  const r = monthReceipt({ year: 2026, month: 9 }, txs, s, '2026-10-17')
  it('totali, categorie dalla più cara e confronto col mese prima', () => {
    expect(r).toMatchObject({ closed: true, income: 1500, spent: 217.5, saved: 150, invested: 100, leftOver: 1132.5 })
    expect(r.lines.map(l => [l.category.id, l.amount, l.count])).toEqual([['groceries', 120, 1], ['funShopping', 90, 1], ['eatingOut', 7.5, 5]])
    expect(r.prev).toMatchObject({ spent: 160, diff: 57.5, pct: 36 })
  })
  it('curiosità a regole', () => {
    expect(r.curiosities).toEqual([
      { id: 'priciestDay', date: '2026-09-03', amount: 121.5 },
      { id: 'daysLogged', days: 9, of: 30 },
      { id: 'savedShare', pct: 10 },
      { id: 'smallOnes', count: 5, amount: 7.5 },
      { id: 'biggest', description: 'Spesa', amount: 120 },
    ])
  })
  it('il primo mese non ha confronto', () => {
    expect(monthReceipt({ year: 2026, month: 8 }, txs, s, '2026-10-17').prev).toBeNull()
  })
})
