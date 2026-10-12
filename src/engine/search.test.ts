import { describe, expect, it } from 'vitest'
import { defaultSettings, filterTransactions, monthsBetween, periodStart, signedTotal, transactionsInMonths, EMPTY_FILTER, type Transaction } from '.'

const s = defaultSettings({ currency: 'EUR', firstMonth: { year: 2026, month: 8 } })
const id = (type: string, i = 0) => s.categories.filter(c => c.type === type)[i].id
const tx = (i: string, date: string, amount: number, category: string, description: string): Transaction =>
  ({ id: i, date, amount, category, description, currency: null, paidFrom: null }) as unknown as Transaction
const txs = [
  tx('a', '2026-08-03', 1500, id('income'), 'Stipendio agosto'), tx('b', '2026-08-10', 12.5, id('expense', 4), 'Pizzeria Da Mario'),
  tx('c', '2026-09-12', 40, id('expense', 2), 'Benzina'), tx('d', '2026-10-05', 12.5, id('expense', 4), 'Caffè e brioche'),
]
const names = { category: (c: string | null) => s.categories.find(x => x.id === c)?.name ?? '', bucket: () => '' }
const all = transactionsInMonths(monthsBetween(s.firstMonth, { year: 2026, month: 10 }, s), txs, s, '2026-10-12').filter(t => !t.recurring)

describe('ricerca e filtri', () => {
  it('periodi', () => {
    expect(monthsBetween(periodStart('3m', { year: 2026, month: 10 }, s), { year: 2026, month: 10 }, s).map(m => m.month)).toEqual([10, 9, 8])
    expect(monthsBetween(periodStart('year', { year: 2026, month: 10 }, s), { year: 2026, month: 10 }, s)).toHaveLength(3)   // non prima del primo mese
  })
  it('testo senza accenti e maiuscole, più parole', () => {
    expect(filterTransactions(all, { ...EMPTY_FILTER, q: 'PIZZERIA mario' }, names).map(t => t.id)).toEqual(['b'])
    expect(filterTransactions(all, { ...EMPTY_FILTER, q: 'caffe' }, names).map(t => t.id)).toEqual(['d'])
  })
  it('importo scritto all\'italiana', () => {
    expect(filterTransactions(all, { ...EMPTY_FILTER, q: '12,50' }, names).map(t => t.id).sort()).toEqual(['b', 'd'])
    expect(filterTransactions(all, { ...EMPTY_FILTER, q: '1.500' }, names).map(t => t.id)).toEqual(['a'])
  })
  it('tipo, categoria, importo minimo e massimo; totale con segno', () => {
    const out = filterTransactions(all, { ...EMPTY_FILTER, types: ['expense'], min: 20 }, names)
    expect(out.map(t => t.id)).toEqual(['c'])
    expect(filterTransactions(all, { ...EMPTY_FILTER, categories: [id('expense', 4)], max: 13 }, names)).toHaveLength(2)
    expect(signedTotal(filterTransactions(all, EMPTY_FILTER, names))).toBe(1500 - 12.5 - 40 - 12.5)
  })
})
