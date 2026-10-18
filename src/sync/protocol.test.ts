import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../engine'
import type { AppData } from '../store/types'
import { clone, reconcile } from './protocol'
const tx = (id: string, amount = 1) => ({ id, amount, date: '2026-10-18', description: id, category: 'groceries' })
const make = (...ids: string[]): AppData => ({ version: 1, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }), transactions: ids.map(id => tx(id)) })
describe('three-way synchronization', () => {
  it('preserves independent additions and unknown document fields without financial rounding', () => {
    const base = { ...make(), retained: { precision: 0.000123456 } }, a = clone(base), b = clone(base)
    a.transactions.push(tx('one')); b.transactions.push(tx('two'))
    expect(reconcile(base, a, b)).toMatchObject({ paths: [], document: { retained: base.retained, transactions: expect.arrayContaining([tx('one'), tx('two')]) } })
  })
  it('does not invent a common base for different existing archives', () => {
    expect(reconcile(null, make('local'), make('remote')).paths).toEqual(['/document'])
  })
  it('blocks incompatible edits even when a device clock is far in the future', () => {
    const base = make('one'), a = clone(base), b = clone(base)
    a.transactions[0] = { ...tx('one', 20), updatedAt: '2100-01-01' }; b.transactions[0] = { ...tx('one', 30), updatedAt: '1900-01-01' }
    expect(reconcile(base, a, b).paths).toEqual(['/transactions/one'])
  })
  it('blocks modification versus deletion without resurrecting or discarding an edit', () => {
    const base = make('one'), a = clone(base), b = make()
    a.transactions[0].amount = 20; b.deleted = { one: '2100-01-01' }
    expect(reconcile(base, a, b).paths).toEqual(['/transactions/one'])
  })
  it('blocks incompatible settings and preserves both documents', () => {
    const base = make(), a = clone(base), b = clone(base); a.settings.currency = 'USD'; b.settings.currency = 'GBP'
    expect(reconcile(base, a, b).paths).toEqual(['/document']); expect(a.settings.currency).toBe('USD')
  })
  it('does not silently collapse duplicate transaction IDs', () => {
    expect(reconcile(make(), make('duplicate', 'duplicate'), make('other')).paths).toEqual(['/document'])
  })
  it('accepts identical archives and an unmodified side, with exact values', () => {
    const a = make('one'); a.transactions[0].amount = 0.000123456
    expect(reconcile(null, a, clone(a))).toEqual({ paths: [], document: a })
    expect(reconcile(a, a, null)).toEqual({ paths: [], document: null })
  })
  it('preserves existing IDs that coincide with JavaScript prototype property names', () => {
    const base = make('__proto__', 'constructor'), local = clone(base), remote = clone(base)
    local.transactions = []; local.deleted = { ['__proto__']: '2026-10-18', constructor: '2026-10-18' }; remote.transactions.push(tx('independent'))
    const result = reconcile(base, local, remote)
    expect(result.paths).toEqual([]); expect(Object.hasOwn(result.document!.deleted!, '__proto__')).toBe(true)
    expect(Object.hasOwn(result.document!.deleted!, 'constructor')).toBe(true)
  })
})
