import { describe, expect, it } from 'vitest'
import { treemap } from './treemap'

describe('treemap', () => {
  const items = [{ id: 'gym', value: 540 }, { id: 'dazn', value: 420 }, { id: 'gpt', value: 276 }, { id: 'spotify', value: 144 },
    { id: 'disney', value: 108 }, { id: 'netflix', value: 54 }, { id: 'icloud', value: 36 }, { id: 'zero', value: 0 }]
  const tiles = treemap(items, 110)
  it('un blocco per valore positivo, area proporzionale, tutto dentro il contenitore', () => {
    expect(tiles).toHaveLength(7)
    const total = 540 + 420 + 276 + 144 + 108 + 54 + 36
    for (const t of tiles) {
      const v = items.find(i => i.id === t.id)!.value
      expect(t.w * t.h).toBeCloseTo((v / total) * 100 * 110, 6)
      expect(t.x).toBeGreaterThanOrEqual(-1e-9); expect(t.y).toBeGreaterThanOrEqual(-1e-9)
      expect(t.x + t.w).toBeLessThanOrEqual(100 + 1e-9); expect(t.y + t.h).toBeLessThanOrEqual(110 + 1e-9)
    }
    expect(tiles.reduce((a, t) => a + t.w * t.h, 0)).toBeCloseTo(100 * 110, 6)
  })
  it('blocchi vicini al quadrato e il più grande per primo', () => {
    expect(tiles[0].id).toBe('gym')
    for (const t of tiles.slice(0, 4)) expect(Math.max(t.w / t.h, t.h / t.w)).toBeLessThan(3)
  })
  it('vuoto se non c\'è niente da disporre', () => {
    expect(treemap([])).toEqual([])
    expect(treemap([{ id: 'a', value: 0 }])).toEqual([])
    expect(treemap([{ id: 'a', value: 5 }])).toEqual([{ id: 'a', x: 0, y: 0, w: 100, h: 100 }])
  })
})
