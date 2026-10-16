import { afterEach, describe, expect, it, vi } from 'vitest'
import { local } from './storage'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const broken = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') }, removeItem: () => { throw new Error('no') } }

afterEach(() => vi.unstubAllGlobals())

describe('local', () => {
  it('legge, scrive e cancella', () => {
    vi.stubGlobal('localStorage', memory())
    expect(local.set('a', '1')).toBe(true)
    expect(local.get('a')).toBe('1')
    local.set('a', null)
    expect(local.get('a')).toBeNull()
  })
  it('JSON con valore di riserva se manca o è rovinato', () => {
    vi.stubGlobal('localStorage', memory())
    expect(local.json('x', [1])).toEqual([1])
    local.setJson('x', { n: 2 })
    expect(local.json('x', {})).toEqual({ n: 2 })
    local.set('x', '{rotto')
    expect(local.json('x', 'riserva')).toBe('riserva')
  })
  it('senza memoria non si rompe e dice che non ha salvato', () => {
    vi.stubGlobal('localStorage', broken)
    expect(local.get('a')).toBeNull()
    expect(local.set('a', '1')).toBe(false)
    expect(local.json('a', 7)).toBe(7)
  })
})
