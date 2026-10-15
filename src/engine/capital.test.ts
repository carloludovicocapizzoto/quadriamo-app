import { describe, expect, it } from 'vitest'
import { canUse, capitalSummary, defaultPolicy, updateCapital, type Capital } from './capital'

const cap: Capital = {
  date: '2026-10-01',
  parts: [
    { id: 'a', name: 'Fondo emergenza', kind: 'emergency', amount: 4000, policy: 'emergency' },
    { id: 'b', name: 'Liquidità', kind: 'liquid', amount: 2000, policy: 'always' },
    { id: 'c', name: 'Auto', kind: 'goal', amount: 2000, policy: 'big', bigPurchases: ['car'] },
  ],
  history: [{ date: '2026-10-01', total: 8000 }],
}

describe('Capitale iniziale', () => {
  it('protetto, utilizzabile e quanto ne resta', () => {
    expect(capitalSummary(cap)).toEqual({ total: 8000, usable: 2000, protected: 6000, start: 8000, preserved: 1 })
    const later = updateCapital(cap, cap.parts.map(p => p.id === 'b' ? { ...p, amount: 1200 } : p), '2026-10-20')
    expect(later.history).toHaveLength(2)
    expect(capitalSummary(later).preserved).toBeCloseTo(7200 / 8000)
    // lo stesso giorno aggiorna, non aggiunge
    expect(updateCapital(later, later.parts, '2026-10-20').history).toHaveLength(2)
  })
  it('regole d\'uso', () => {
    expect(canUse(cap.parts[0], 'everyday')).toBe(false)
    expect(canUse(cap.parts[0], 'emergency')).toBe(true)
    expect(canUse(cap.parts[1], 'everyday')).toBe(true)
    expect(canUse(cap.parts[2], 'car')).toBe(true)
    expect(canUse(cap.parts[2], 'travel')).toBe(false)
    expect(defaultPolicy('emergency')).toBe('emergency')
    expect(defaultPolicy('locked')).toBe('never')
  })
})

import { capitalAdvice, partForPurchase } from './capital'
describe('Capitale: consigli', () => {
  it('mese in rosso: la liquidità basta, o il resto è protetto', () => {
    expect(capitalAdvice(cap, -300, 0)[0]).toEqual({ id: 'cover', deficit: 300, part: 'Liquidità', available: 2000 })
    expect(capitalAdvice(cap, -2500, 0)[0]).toEqual({ id: 'protectedOnly', deficit: 2500, usable: 2000 })
    expect(capitalAdvice(cap, 100, 0)).toEqual([])
  })
  it('fondo di emergenza sotto i 3 mesi e capitale usato', () => {
    expect(capitalAdvice(cap, null, 2000)).toEqual([{ id: 'emergencyLow', months: 2 }])
    const used = { ...cap, history: [{ date: '2026-01-01', total: 12000 }, ...cap.history] }
    expect(capitalAdvice(used, null, 0)).toEqual([{ id: 'used', pct: 33 }])
  })
  it('una spesa per l\'auto può venire dalla parte "solo grandi acquisti: auto"', () => {
    expect(partForPurchase(cap, 'transport', 1500)?.id).toBe('c')
    expect(partForPurchase(cap, 'transport', 2500)).toBeNull()
    expect(partForPurchase(cap, 'groceries', 100)).toBeNull()
  })
})
