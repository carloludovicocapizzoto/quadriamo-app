import { describe, expect, it } from 'vitest'
import { activateScope, dataKey, onScopeChange, type DataScope } from './scope'
import { composerSnapshot, openComposer } from '../app/composer'
import { parseBackup } from './backup'
import { defaultSettings } from '../engine'

const a: DataScope = { environment: 'test', backend: 'one', kind: 'account', owner: 'A' }
describe('runtime scope', () => {
  it('aborts a lease permanently, even after returning to the same user', () => {
    const first = activateScope(a)
    activateScope({ ...a, owner: 'B' })
    activateScope(a)
    expect(first.signal.aborted).toBe(true)
    expect(first.current()).toBe(false)
    expect(() => first.assert()).toThrow()
  })
  it('separates owner, mode, environment and backend, including delimiter characters', () => {
    const variants = [a, { ...a, owner: 'B' }, { ...a, environment: 'other' }, { ...a, backend: 'other' },
      { ...a, kind: 'demo' as const }, { ...a, kind: 'recovery' as const }, { ...a, owner: 'A/other|account' }]
    expect(new Set(variants.map(dataKey)).size).toBe(variants.length)
  })
  it('clears an open editor and its retained transaction on switch', () => {
    activateScope(a)
    openComposer({ tx: { id: 'A-only', description: 'A-only', date: null, category: null, amount: 10 } })
    activateScope({ ...a, owner: 'B' })
    expect(composerSnapshot()).toMatchObject({ open: false, value: {} })
  })
  it('restoring demo JSON retains the flag used to deny account imports', () => {
    const data = { version: 1, demo: true, transactions: [], settings: defaultSettings({ firstMonth: { year: 2026, month: 1 } }) }
    expect(parseBackup(JSON.stringify(data)).demo).toBe(true)
  })
  it('an accessory listener failure cannot leave the old identity active', () => {
    const first = activateScope(a)
    const stop = onScopeChange(() => { throw Error('broken accessory') })
    try {
      expect(activateScope({ ...a, owner: 'B' }).scope.owner).toBe('B')
      expect(first.current()).toBe(false)
    } finally { stop() }
  })
})
