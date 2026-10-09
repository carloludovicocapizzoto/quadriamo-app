import { describe, expect, it } from 'vitest'
import { createInitial, parseAmount, parseBackup, reducer, validateSettings, type State } from './state'

const base = (): State => ({ loaded: true, data: createInitial('EUR', '2026-10-09') })

describe('reducer', () => {
  it('adds, updates and deletes a transaction', () => {
    let s = base()
    s = reducer(s, { type: 'addTx', tx: { id: 'a', date: '2026-10-09', description: 'Pizza', category: 'eatingOut', amount: 12 } })
    expect(s.data!.transactions).toHaveLength(1)
    s = reducer(s, { type: 'updateTx', tx: { ...s.data!.transactions[0], amount: 15 } })
    expect(s.data!.transactions[0].amount).toBe(15)
    s = reducer(s, { type: 'deleteTx', id: 'a' })
    expect(s.data!.transactions).toHaveLength(0)
  })
  it('moves the first month back for older transactions', () => {
    const s = reducer(base(), { type: 'addTx', tx: { id: 'a', date: '2026-08-01', description: 'Old', category: 'other', amount: 1 } })
    expect(s.data!.settings.firstMonth).toEqual({ year: 2026, month: 8 })
  })
  it('starts in the current month with the 55-20-15-10 rule', () => {
    const d = createInitial('USD', '2026-10-09').settings
    expect(d.firstMonth).toEqual({ year: 2026, month: 10 })
    expect(d.buckets.map(b => b.share)).toEqual([0.55, 0.2, 0.15, 0.1])
    expect(d.currency).toBe('USD')
  })
})

describe('validateSettings', () => {
  it('accepts the defaults', () => { expect(validateSettings(base().data!.settings)).toEqual([]) })
  it('rejects shares that do not add up to 100%', () => {
    const s = base().data!.settings
    s.buckets[0].share = 0.5
    expect(validateSettings(s)).toContain('sharesNot100')
  })
  it('rejects a bad start day and a bad recurring payment', () => {
    const s = base().data!.settings
    s.monthStartDay = 31
    s.recurring.push({ name: 'Gym', amount: 0, category: 'health', day: 1, active: true })
    expect(validateSettings(s)).toEqual(expect.arrayContaining(['startDay', 'recurring']))
  })
})

describe('backup', () => {
  it('round-trips', () => {
    const d = base().data!
    expect(parseBackup(JSON.stringify(d)).settings.currency).toBe('EUR')
  })
  it('rejects other files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow()
    expect(() => parseBackup('not json')).toThrow()
  })
})

describe('parseAmount', () => {
  it.each([['12,50', 12.5], ['12.50', 12.5], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['€ 7', 7], ['', null], ['abc', null]])(
    '%s -> %s', (raw, n) => { expect(parseAmount(raw)).toBe(n) })
})
