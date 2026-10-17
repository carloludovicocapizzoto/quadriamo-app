import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { computeMonth, monthCache } from './month'
import type { Transaction } from './types'

const s = defaultSettings({ firstMonth: { year: 2026, month: 1 } })
const txs: Transaction[] = [
  { id: '1', date: '2026-01-02', description: 'Stipendio', category: 'salary', amount: 1500 },
  { id: '2', date: '2026-03-05', description: 'Spesa', category: 'groceries', amount: 60 },
]
const ym = { year: 2026, month: 3 }

describe('cache dei mesi condivisa', () => {
  it('stessi dati e stesso giorno: il mese si calcola una volta sola', () => {
    const a = computeMonth(ym, txs, s, '2026-03-10'), b = computeMonth(ym, txs, s, '2026-03-10')
    expect(b).toBe(a)
    expect(monthCache(txs, s, '2026-03-10').has('2026-01')).toBe(true)   // anche i mesi prima, per il riporto
  })
  it('dati cambiati (nuovi oggetti) o un altro giorno: si ricalcola', () => {
    const a = computeMonth(ym, txs, s, '2026-03-10')
    const more = [...txs, { id: '3', date: '2026-03-06', description: 'Cena', category: 'eatingOut', amount: 25 }]
    expect(computeMonth(ym, more, s, '2026-03-10').spent).toBe(a.spent + 25)
    expect(computeMonth(ym, txs, { ...s }, '2026-03-10')).not.toBe(a)
    expect(computeMonth(ym, txs, s, '2026-03-11')).not.toBe(a)
  })
  it('con un riporto passato a mano il risultato non entra nella cache', () => {
    const normal = computeMonth(ym, txs, s, '2026-03-12')
    const custom = computeMonth(ym, txs, s, '2026-03-12', { essentials: 999 })
    expect(custom).not.toBe(normal)
    expect(computeMonth(ym, txs, s, '2026-03-12')).toBe(normal)
  })
})
