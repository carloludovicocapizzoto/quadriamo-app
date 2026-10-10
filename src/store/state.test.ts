import { describe, expect, it } from 'vitest'
import { createInitial, mergeData, planImport, parseAmount, parseBackup, reducer, toCsv, validateSettings, type State } from './state'

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

describe('sync merge between two devices', () => {
  const base2 = () => createInitial('EUR', '2026-10-09')
  const tx = (id: string, amount: number, updatedAt: string) =>
    ({ id, date: '2026-10-09', description: id, category: 'groceries', amount, updatedAt })

  it('keeps transactions added on both devices', () => {
    const a = { ...base2(), transactions: [tx('a', 10, '2026-10-09T10:00:00Z')] }
    const b = { ...base2(), transactions: [tx('b', 20, '2026-10-09T11:00:00Z')] }
    expect(mergeData(a, b).transactions.map(t => t.id).sort()).toEqual(['a', 'b'])
  })
  it('the most recent edit wins', () => {
    const a = { ...base2(), transactions: [tx('a', 10, '2026-10-09T10:00:00Z')] }
    const b = { ...base2(), transactions: [tx('a', 15, '2026-10-09T12:00:00Z')] }
    expect(mergeData(a, b).transactions[0].amount).toBe(15)
    expect(mergeData(b, a).transactions[0].amount).toBe(15)
  })
  it('a deletion is not undone by the other device', () => {
    const a = { ...base2(), transactions: [], deleted: { a: '2026-10-09T13:00:00Z' } }
    const b = { ...base2(), transactions: [tx('a', 10, '2026-10-09T10:00:00Z')] }
    expect(mergeData(a, b).transactions).toHaveLength(0)
    expect(mergeData(b, a).transactions).toHaveLength(0)
  })
  it('an edit made after the deletion brings it back', () => {
    const a = { ...base2(), transactions: [], deleted: { a: '2026-10-09T13:00:00Z' } }
    const b = { ...base2(), transactions: [tx('a', 10, '2026-10-09T14:00:00Z')] }
    expect(mergeData(a, b).transactions).toHaveLength(1)
  })
  it('newer settings win and the first month covers every transaction', () => {
    const a = { ...base2(), settingsUpdatedAt: '2026-10-09T10:00:00Z' }
    const b = { ...base2(), settingsUpdatedAt: '2026-10-09T12:00:00Z',
                transactions: [{ ...tx('old', 5, '2026-10-09T12:00:00Z'), date: '2026-07-03' }] }
    b.settings = { ...b.settings, currency: 'CHF' }
    const m = mergeData(a, b)
    expect(m.settings.currency).toBe('CHF')
    expect(m.settings.firstMonth).toEqual({ year: 2026, month: 7 })
  })
  it('reducer stamps edits and records deletions', () => {
    let s = base()
    s = reducer(s, { type: 'addTx', tx: tx('x', 1, ''), at: '2026-10-09T09:00:00Z' })
    expect(s.data!.transactions[0].updatedAt).toBe('2026-10-09T09:00:00Z')
    s = reducer(s, { type: 'deleteTx', id: 'x', at: '2026-10-09T09:30:00Z' })
    expect(s.data!.deleted).toEqual({ x: '2026-10-09T09:30:00Z' })
  })
})

describe('csv export', () => {
  it('writes one row per transaction, quoting when needed', () => {
    const d = { ...createInitial('EUR', '2026-10-09'),
      transactions: [{ id: 'a', date: '2026-10-01', description: 'Pizza, beer', category: 'eatingOut', amount: 12.5 }] }
    const csv = toCsv(d, { category: id => id ?? '', bucket: id => id ?? '' })
    expect(csv.split('\n')[1]).toBe('2026-10-01,"Pizza, beer",eatingOut,12.5,EUR,')
  })
})

describe('investments sync', () => {
  it('the most recent investments win', () => {
    const inv = (m: number) => ({ holdings: [], deposits: [], pac: { monthly: m, yearlyReturn: 0.05, years: 5 }, portfolioValues: {} })
    const a = { ...createInitial('EUR', '2026-10-09'), investments: inv(100), investmentsUpdatedAt: '2026-10-09T10:00:00Z' }
    const b = { ...createInitial('EUR', '2026-10-09'), investments: inv(200), investmentsUpdatedAt: '2026-10-09T11:00:00Z' }
    expect(mergeData(a, b).investments!.pac.monthly).toBe(200)
    expect(mergeData(b, a).investments!.pac.monthly).toBe(200)
    expect(mergeData(a, createInitial('EUR', '2026-10-09')).investments!.pac.monthly).toBe(100)
  })
})

describe('import inbox', () => {
  const rows = [
    { date: '2026-10-02', description: 'POS ESSELUNGA', amount: -52.3, currency: 'EUR' },
    { date: '2026-10-03', description: 'Negozio X', amount: -10, currency: 'EUR' },
  ]
  it('proposes categories and skips duplicates on a second import', () => {
    let st = base()
    const p1 = planImport(st.data!, rows)
    expect(p1.items.map(i => i.category)).toEqual(['groceries', null])
    st = reducer(st, { type: 'addInbox', items: p1.items })
    expect(planImport(st.data!, rows)).toMatchObject({ items: [], duplicates: 2 })
  })
  it('confirming creates the transaction and an optional rule; confirmed rows never come back', () => {
    let st = base()
    st = reducer(st, { type: 'addInbox', items: planImport(st.data!, rows).items })
    const item = st.data!.inbox![1]
    st = reducer(st, { type: 'confirmInbox', ids: [item.id], at: '2026-10-10T10:00:00Z',
      txs: [{ id: 't', date: item.date, description: item.description, category: 'funShopping', amount: 10 }],
      rule: { id: 'r', keyword: 'negozio x', category: 'funShopping', enabled: true } })
    expect(st.data!.transactions).toHaveLength(1)
    expect(st.data!.inbox).toHaveLength(1)
    expect(st.data!.settings.rules!.some(r => r.keyword === 'negozio x')).toBe(true)
    expect(planImport(st.data!, rows).duplicates).toBe(2)
  })
  it('ignored rows never come back, also after syncing with another device', () => {
    let a = base()
    a = reducer(a, { type: 'addInbox', items: planImport(a.data!, rows).items })
    const other = structuredClone(a.data!)
    a = reducer(a, { type: 'ignoreInbox', ids: [a.data!.inbox![0].id], at: '2026-10-10T10:00:00Z' })
    const m = mergeData(other, a.data!)
    expect(m.inbox).toHaveLength(1)
    expect(m.inbox![0].description).toBe('Negozio X')
  })
})

describe('rules migration', () => {
  it('a learned rule is added to the starting rules, not instead of them', () => {
    let st: State = { loaded: true, data: { ...createInitial('EUR', '2026-10-09') } }
    st.data!.settings = { ...st.data!.settings, rules: undefined }
    st = reducer({ loaded: false, data: null }, { type: 'load', data: st.data })
    st = reducer(st, { type: 'confirmInbox', ids: [], txs: [], rule: { id: 'x', keyword: 'bar centrale', category: 'eatingOut', enabled: true } })
    const rules = st.data!.settings.rules!
    expect(rules.some(r => r.keyword === 'esselunga')).toBe(true)
    expect(rules.some(r => r.keyword === 'bar centrale')).toBe(true)
  })
})
