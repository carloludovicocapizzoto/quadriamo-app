import { describe, expect, it } from 'vitest'
import { applyPersona, defaultSettings, mainIncome } from '.'

const base = defaultSettings({ currency: 'EUR', firstMonth: { year: 2026, month: 10 } })
describe('chi sei', () => {
  it('studente: regola senza investimenti, categorie da studente, una volta sola', () => {
    const s = applyPersona(applyPersona(base, 'student'), 'student')
    expect(s.buckets.map(b => b.share)).toEqual([0.45, 0.35, 0.2, 0])
    expect(s.buckets.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1)
    expect(s.categories.filter(c => ['allowance', 'partTime', 'university'].includes(c.id))).toHaveLength(3)
    expect(s.categories[0].id).toBe('allowance')
    expect(s.categories.findIndex(c => c.id === 'university')).toBe(s.categories.findIndex(c => c.id === 'fixedCosts') + 1)
    expect(mainIncome(s)).toBe('allowance')
  })
  it('lavoro: torna la regola 55-20-15-10', () => {
    const s = applyPersona(applyPersona(base, 'student'), 'worker')
    expect(s.buckets.map(b => b.share)).toEqual([0.55, 0.2, 0.15, 0.1])
    expect(mainIncome(s)).toBe('salary')
  })
})
