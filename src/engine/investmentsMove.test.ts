import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { emptyInvestments, holdingMove, investmentsWithLive, portfolioMove, portfolioSummary, recordPrice, type Holding } from './investments'

const s = { ...defaultSettings({ firstMonth: { year: 2026, month: 1 } }), currency: 'EUR', fxRates: { USD: 0.9 } }
const etf: Holding = { id: 'etf', name: 'World ETF', type: 'etf', units: 10, avgPrice: 100, manualPrice: 110 }
const btc: Holding = { id: 'btc', name: 'Bitcoin', type: 'crypto', ticker: 'BTC', units: 0.5, avgPrice: 40000, manualPrice: null }

describe('prezzi scritti a mano', () => {
  it('nello stesso giorno vince l’ultimo, in un giorno nuovo si aggiunge solo se cambia', () => {
    let d = recordPrice([], '2026-10-27', 1)
    d = recordPrice(d, '2026-10-27', 100)
    expect(d).toEqual([{ date: '2026-10-27', price: 100 }])
    expect(recordPrice(d, '2026-10-28', 100)).toBe(d)
    d = recordPrice(d, '2026-10-29', 110)
    expect(d).toEqual([{ date: '2026-10-27', price: 100 }, { date: '2026-10-29', price: 110 }])
    expect(recordPrice(d, '2026-10-30', 120)).toEqual([{ date: '2026-10-29', price: 110 }, { date: '2026-10-30', price: 120 }])
  })
  it('variazione dall’ultimo prezzo diverso', () => {
    const m = holdingMove(etf, s, null, [{ date: '2026-10-27', price: 100 }, { date: '2026-10-29', price: 110 }])
    expect(m?.amount).toBeCloseTo(100); expect(m?.pct).toBeCloseTo(0.1); expect(m?.since).toBe('2026-10-27')
  })
  it('senza un prezzo precedente, o se il prezzo è cambiato su un altro dispositivo, nessuna variazione', () => {
    expect(holdingMove(etf, s, null, [{ date: '2026-10-29', price: 110 }])).toBeNull()
    expect(holdingMove(etf, s, null, [{ date: '2026-10-27', price: 100 }, { date: '2026-10-28', price: 105 }])).toBeNull()
  })
  it('il prezzo a mano vince su quello automatico', () => {
    expect(holdingMove({ ...btc, manualPrice: 50000 }, s, { price: 60000, change: 0.1, at: '' }, [])).toBeNull()
  })
})

describe('prezzi automatici', () => {
  it('variazione nelle 24 ore, convertita nella tua valuta', () => {
    const m = holdingMove({ ...btc, currency: 'USD' }, s, { price: 66000, change: 0.1, at: '' })
    expect(m?.pct).toBeCloseTo(0.1); expect(m?.amount).toBeCloseTo(0.5 * 6000 * 0.9); expect(m?.since).toBeNull()
  })
  it('senza quote o senza cambio, nessuna variazione', () => {
    expect(holdingMove({ ...btc, units: null }, s, { price: 1, change: 0.1, at: '' })).toBeNull()
    expect(holdingMove({ ...btc, currency: 'JPY' }, s, { price: 1, change: 0.1, at: '' })).toBeNull()
    expect(holdingMove(btc, s, { price: 1, change: null, at: '' })).toBeNull()
  })
  it('il prezzo del dispositivo entra nel valore di sempre', () => {
    const inv = { ...emptyInvestments(), holdings: [btc] }
    expect(portfolioSummary(inv, s, '2026-10-29').value).toBeNull()
    expect(portfolioSummary(investmentsWithLive(inv, { btc: { price: 60000, change: 0, at: '' } }), s, '2026-10-29').value).toBeCloseTo(30000)
  })
})

describe('movimento del portafoglio', () => {
  const inv = { ...emptyInvestments(), holdings: [etf, btc, { ...etf, id: 'x', manualPrice: null }] }
  it('somma i titoli con un confronto e calcola la percentuale su quanto valevano prima', () => {
    const m = portfolioMove(inv, s, { btc: { price: 60000, change: 0.2, at: '' } },
      { etf: [{ date: '2026-10-27', price: 100 }, { date: '2026-10-29', price: 110 }] })
    // etf: 1000 → 1100 (+100); btc: 25000 → 30000 (+5000)
    expect(m?.amount).toBeCloseTo(5100); expect(m?.pct).toBeCloseTo(5100 / 26000); expect(m?.count).toBe(2)
    expect(m?.since).toBe('2026-10-27')
  })
  it('solo prezzi automatici: nelle 24 ore', () => {
    expect(portfolioMove(inv, s, { btc: { price: 60000, change: 0.2, at: '' } }, {})?.since).toBeNull()
  })
  it('nessun confronto: niente da mostrare', () => {
    expect(portfolioMove(inv, s, {}, {})).toBeNull()
  })
})
