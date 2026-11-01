import { describe, expect, it } from 'vitest'
import { emptyInvestments, type Holding } from '../engine'
import { rememberManual } from './livePrices'

const h = (id: string, manualPrice: number | null): Holding => ({ id, name: id, units: 1, avgPrice: 1, manualPrice })

describe('memoria dei prezzi a mano', () => {
  it('ricorda il prezzo di oggi e dimentica i titoli tolti', () => {
    const inv = { ...emptyInvestments(), holdings: [h('a', 110), h('b', null)] }
    const p = rememberManual({ live: {}, days: { a: [{ date: '2026-10-27', price: 100 }], b: [{ date: '2026-10-27', price: 5 }], gone: [{ date: '2026-10-27', price: 1 }] } }, inv, '2026-10-29')
    expect(p.days).toEqual({ a: [{ date: '2026-10-27', price: 100 }, { date: '2026-10-29', price: 110 }], b: [{ date: '2026-10-27', price: 5 }] })
  })
  it('i prezzi automatici restano per moneta, non per titolo', () => {
    const live = { 'bitcoin:eur': { price: 1, change: 0, at: 'T' } }
    expect(rememberManual({ live, days: {} }, emptyInvestments(), '2026-10-29').live).toBe(live)
  })
})
