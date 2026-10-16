import { describe, expect, it } from 'vitest'
import { computeMonth, defaultSettings, recurringOf, remainingCount, type Recurring, type Transaction } from './index'

const rata: Recurring = { name: 'Rata auto', amount: 180, category: 'loans', day: 10, active: true, until: '2026-12' }
const s = defaultSettings({ firstMonth: { year: 2026, month: 1 }, recurring: [rata] })
const tx = (date: string): Transaction => ({ id: date, date, description: 'Spesa', category: 'groceries', amount: 20 })

describe('rate di un finanziamento', () => {
  it('contano fino all’ultimo mese e poi smettono da sole', () => {
    expect(recurringOf({ year: 2026, month: 12 }, [tx('2026-12-02')], s, '2026-12-20').map(t => t.amountIn)).toEqual([180])
    expect(recurringOf({ year: 2027, month: 1 }, [tx('2027-01-02')], s, '2027-01-20')).toEqual([])
  })
  it('diventano un evento del calendario con le rate che restano', () => {
    const e = s.events[0]
    expect([e.kind, e.date, e.until]).toEqual(['loan', '2026-01-10', '2026-12-31'])
    expect(remainingCount(e, '2026-10-01')).toBe(3)
    expect(remainingCount(e, '2027-02-01')).toBe(0)
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

describe('entrate divise a modo mio', () => {
  const s0 = defaultSettings({ firstMonth: { year: 2026, month: 10 } })
  const extra = (x: Partial<Transaction> = {}): Transaction => ({ id: 'e', date: '2026-10-05', description: 'Ripetizioni', category: 'extraIncome', amount: 200, ...x })
  const parts = (r: ReturnType<typeof computeMonth>) => Object.fromEntries(r.buckets.map(b => [b.bucket.id, Math.round(b.fromIncome * 100) / 100]))
  const ym = { year: 2026, month: 10 }
  it('senza scelte va con la regola', () => {
    expect(parts(computeMonth(ym, [extra()], s0, '2026-10-10'))).toEqual({ essentials: 110, qualityOfLife: 40, safetyFund: 30, investments: 20 })
  })
  it('la categoria può mandarla tutta in una parte o dividerla con le sue quote', () => {
    const toFund = { ...s0, categories: s0.categories.map(c => c.id === 'extraIncome' ? { ...c, defaultBucket: 'safetyFund' } : c) }
    expect(parts(computeMonth(ym, [extra()], toFund, '2026-10-10')).safetyFund).toBe(200)
    const custom = { ...s0, categories: s0.categories.map(c => c.id === 'extraIncome'
      ? { ...c, defaultBucket: 'custom', split: { qualityOfLife: 0.5, investments: 0.5 } } : c) }
    expect(parts(computeMonth(ym, [extra()], custom, '2026-10-10'))).toEqual({ essentials: 0, qualityOfLife: 100, safetyFund: 0, investments: 100 })
  })
  it('il singolo movimento vince sulla categoria', () => {
    const r = computeMonth(ym, [extra({ paidFrom: 'custom', split: { essentials: 0.25, safetyFund: 0.75 } })], s0, '2026-10-10')
    expect(parts(r)).toEqual({ essentials: 50, qualityOfLife: 0, safetyFund: 150, investments: 0 })
    expect(parts(computeMonth(ym, [extra({ paidFrom: 'split', split: { essentials: 1 } })], s0, '2026-10-10')).essentials).toBe(110)
  })
})
