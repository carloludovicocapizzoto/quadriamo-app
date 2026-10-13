import { describe, expect, it } from 'vitest'
import { computeMonth, defaultSettings, installmentsLeft, recurringOf, untilAfter, type Recurring, type Transaction } from './index'

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

describe('affitto prima delle parti', () => {
  const rent: Recurring = { name: 'Affitto', amount: 400, category: 'rent', day: 1, active: true }
  const base = defaultSettings({ firstMonth: { year: 2026, month: 10 }, recurring: [rent] })
  const pay: Transaction = { id: 'p', date: '2026-10-01', description: 'Stipendio', category: 'salary', amount: 1400, paidFrom: 'split' }
  it('si toglie dalle entrate prima di dividerle, anche quando è ancora in arrivo', () => {
    for (const today of ['2026-10-01', '2026-10-15']) {
      const r = computeMonth({ year: 2026, month: 10 }, [pay], base, today)
      expect(r.paidFirst).toBe(400)
      expect(r.buckets.find(b => b.bucket.id === 'essentials')!.fromIncome).toBeCloseTo(1000 * 0.55)
      expect(r.buckets.reduce((a, b) => a + b.fromIncome, 0)).toBeCloseTo(1000)
    }
  })
  it('se l\'affitto supera le entrate, la differenza pesa sulla prima parte', () => {
    const r = computeMonth({ year: 2026, month: 10 }, [{ ...pay, amount: 300 }], base, '2026-10-15')
    expect(r.buckets.reduce((a, b) => a + b.fromIncome, 0)).toBeCloseTo(-100)
  })
  it('messo negli Essenziali, torna a pesare su quella parte', () => {
    const inside = { ...base, categories: base.categories.map(c => c.id === 'rent' ? { ...c, defaultBucket: 'essentials' } : c) }
    const r = computeMonth({ year: 2026, month: 10 }, [pay], inside, '2026-10-15')
    expect(r.paidFirst).toBe(0)
    expect(r.buckets.find(b => b.bucket.id === 'essentials')!.spent).toBe(400)
  })
})
