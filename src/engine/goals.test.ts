import { describe, expect, it } from 'vitest'
import { goalStatus, mergeGoals, type Goal } from './goals'

const g = (over: Partial<Goal> = {}): Goal => ({ id: 'g1', name: 'Vacanza', target: 600, deadline: '2027-06', icon: 'plane',
  contributions: [{ id: 'c1', date: '2026-10-01', amount: 100 }], createdAt: '2026-10-01', updatedAt: '2026-10-01T10:00:00Z', ...over })

describe('obiettivi', () => {
  it('quanto manca e quanto al mese', () => {
    const s = goalStatus(g(), '2026-10-12')
    expect(s).toMatchObject({ saved: 100, left: 500, monthsLeft: 9, done: false, late: false })
    expect(s.perMonth).toBeCloseTo(55.56, 2)
    expect(s.pct).toBeCloseTo(1 / 6)
  })
  it('in ritardo rispetto al ritmo, poi raggiunto', () => {
    expect(goalStatus(g({ contributions: [] }), '2027-01-10').onTrack).toBe(false)
    expect(goalStatus(g({ contributions: [{ id: 'c', date: '2026-11-01', amount: 650 }] }), '2027-01-10')).toMatchObject({ done: true, left: 0, perMonth: 0, onTrack: true })
  })
  it('senza scadenza, e scadenza passata', () => {
    expect(goalStatus(g({ deadline: null }), '2026-10-12')).toMatchObject({ perMonth: null, onTrack: null })
    expect(goalStatus(g({ deadline: '2026-11' }), '2027-01-02').late).toBe(true)
  })
  it('unione: vince la modifica più recente', () => {
    const a = g({ name: 'A' }), b = g({ name: 'B', updatedAt: '2026-10-02T00:00:00Z' })
    expect(mergeGoals([a], [b])[0].name).toBe('B')
    expect(mergeGoals([b], [a])[0].name).toBe('B')
  })
  it('unione: i versamenti di due telefoni si sommano, l\'eliminazione vince', () => {
    const a = g({ contributions: [{ id: 'c1', date: '2026-10-01', amount: 100 }, { id: 'c2', date: '2026-10-05', amount: 50 }] })
    const b = g({ contributions: [{ id: 'c1', date: '2026-10-01', amount: 100 }, { id: 'c3', date: '2026-10-06', amount: 20 }], updatedAt: '2026-10-06T00:00:00Z' })
    expect(goalStatus(mergeGoals([a], [b])[0], '2026-10-12').saved).toBe(170)
    expect(mergeGoals([a], [g({ removed: true, contributions: [], updatedAt: '2026-10-02T00:00:00Z' })])[0].removed).toBe(true)
  })
})
