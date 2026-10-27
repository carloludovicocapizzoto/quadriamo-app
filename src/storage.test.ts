import { afterEach, describe, expect, it, vi } from 'vitest'
import { local, personal, personalFor } from './storage'
import { activateScope } from './store/scope'

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
  it('a captured personal cache cannot write into the next account', () => {
    vi.stubGlobal('localStorage', memory())
    const a = activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'A' })
    const callbackCache = personalFor(a.scope)
    activateScope({ ...a.scope, owner: 'B' })
    callbackCache.set('q.sharedBudget', 'A-only')
    expect(personal.get('q.sharedBudget')).toBeNull()
    activateScope(a.scope)
    expect(personal.get('q.sharedBudget')).toBe('A-only')
  })
})
