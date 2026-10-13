import { describe, expect, it } from 'vitest'
import { defaultSettings, installmentsLeft, recurringOf, untilAfter, type Recurring, type Transaction } from './index'

const rata: Recurring = { name: 'Rata auto', amount: 180, category: 'loans', day: 10, active: true, until: '2026-12' }
const s = defaultSettings({ firstMonth: { year: 2026, month: 1 }, recurring: [rata] })
const tx = (date: string): Transaction => ({ id: date, date, description: 'Spesa', category: 'groceries', amount: 20 })

describe('rate di un finanziamento', () => {
  it('contano fino all’ultimo mese e poi smettono da sole', () => {
    expect(recurringOf({ year: 2026, month: 12 }, [tx('2026-12-02')], s, '2026-12-20').map(t => t.amountIn)).toEqual([180])
    expect(recurringOf({ year: 2027, month: 1 }, [tx('2027-01-02')], s, '2027-01-20')).toEqual([])
  })
  it('rate rimaste, compresa quella del mese', () => {
    expect(installmentsLeft(rata, { year: 2026, month: 10 })).toBe(3)
    expect(installmentsLeft(rata, { year: 2027, month: 2 })).toBe(0)
    expect(installmentsLeft({ ...rata, until: undefined }, { year: 2026, month: 10 })).toBeNull()
  })
  it('dal numero di rate all’ultimo mese, anche a cavallo d’anno', () => {
    expect(untilAfter({ year: 2026, month: 10 }, 3)).toBe('2026-12')
    expect(untilAfter({ year: 2026, month: 10 }, 4)).toBe('2027-01')
    expect(untilAfter({ year: 2026, month: 10 }, 15)).toBe('2027-12')
    expect(untilAfter({ year: 2026, month: 10 }, null)).toBeUndefined()
    expect(installmentsLeft({ ...rata, until: untilAfter({ year: 2026, month: 10 }, 8) }, { year: 2026, month: 10 })).toBe(8)
  })
})
