import { describe, expect, it } from 'vitest'
import { lastDays, marketsNow, missions } from './home'
import type { ClassifiedTx } from './types'

const tx = (date: string, amount: number, category = 'groceries', type: ClassifiedTx['type'] = 'expense'): ClassifiedTx =>
  ({ id: date + amount, date, description: '', category, amount, amountIn: amount, type, bucket: 'essentials' })

describe('Widget della Home', () => {
  it('ultimi 7 giorni contro i 7 prima, con la categoria più pesante', () => {
    const txs = [tx('2026-10-15', 20), tx('2026-10-10', 30, 'eatingOut'), tx('2026-10-08', 50), tx('2026-10-05', 99, 'salary', 'income')]
    expect(lastDays(txs, '2026-10-15')).toEqual({ spent: 50, before: 50, count: 2, topCategory: 'eatingOut', topAmount: 30 })
  })
  it('borse aperte e chiuse', () => {
    // mercoledì 14 ottobre 2026, 15:00 ora italiana (13:00 UTC): Milano aperta, New York (9:00) ancora chiusa
    const m = Object.fromEntries(marketsNow(new Date('2026-10-14T13:00:00Z')).map(x => [x.id, x]))
    expect(m.milan.open).toBe(true); expect(m.milan.at).toBe('17:30')
    expect(m.newyork.open).toBe(false); expect(m.newyork.at).toBe('09:30'); expect(m.newyork.today).toBe(true)
    // sabato: tutto chiuso
    expect(marketsNow(new Date('2026-10-17T12:00:00Z')).every(x => !x.open && x.next === 'monday')).toBe(true)
    // mercoledì sera: Milano riapre domani
    expect(marketsNow(new Date('2026-10-14T20:00:00Z'))[0]).toMatchObject({ open: false, next: 'tomorrow', at: '09:00' })
  })
  it('missioni dai dati', () => {
    const m = missions({ loggedToday: true, spentToday: 12, dailyAllowance: 20, streak: 2, savedThisWeek: false })
    expect(m.map(x => x.done)).toEqual([true, true, false, false])
  })
})
