import { describe, expect, it } from 'vitest'
import { defaultSettings, seedRules } from '../engine'
import type { CalEvent } from '../engine/calendar'
import { clone, reconcile, resolveConflict, type DataConflict } from '../sync/protocol'
import { categoryUsage, deleteCategory, moveTargets } from './categories'
import { reducer } from './reducer'
import type { AppData } from './types'

const AT = '2026-10-26T10:00:00.000Z'
const event = (id: string, category: string | null): CalEvent => ({ id, kind: 'subscription', title: id, amount: 9.99, category, date: '2026-10-05',
  repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true }) as CalEvent
const pets = { id: 'pets', name: 'Animali', type: 'expense' as const, defaultBucket: null }
function make(): AppData {
  const s = defaultSettings({ firstMonth: { year: 2026, month: 10 } })
  return {
    version: 1, settingsUpdatedAt: '2026-10-01T08:00:00.000Z',
    settings: { ...s, categories: [...s.categories, { ...pets, defaultBucket: s.buckets[0].id }],
      events: [event('vet', 'pets'), event('rent', 'rent')], rules: [{ id: 'r1', keyword: 'zooplus', category: 'pets', paidFrom: null, enabled: true }] },
    transactions: [{ id: 't1', date: '2026-10-02', description: 'Veterinario', category: 'pets', amount: 40 },
      { id: 't2', date: '2026-10-03', description: 'Spesa', category: 'groceries', amount: 30 }],
    inbox: [{ id: 'i1', fingerprint: 'f1', date: '2026-10-04', description: 'Zooplus', amount: -25, currency: null, category: 'pets', paidFrom: null, source: 'csv' }],
  }
}
/** Ogni riferimento a una categoria punta a una categoria che esiste. */
function dangling(d: AppData): string[] {
  const ids = new Set(d.settings.categories.map(c => c.id))
  const refs = [...d.transactions, ...d.settings.events, ...(d.settings.rules ?? []), ...(d.inbox ?? [])].map(x => x.category)
  return refs.filter((c): c is string => !!c && !ids.has(c))
}

describe('deleting a category never deletes data silently', () => {
  it('counts every use, including the starting import rules the user never touched', () => {
    expect(categoryUsage(make(), 'pets')).toEqual({ transactions: 1, events: 1, rules: 1, inbox: 1 })
    const seeded = { ...make(), settings: { ...make().settings, rules: undefined } }
    const seedCategory = seedRules()[0].category
    expect(categoryUsage(seeded, seedCategory).rules).toBeGreaterThan(0)
  })
  it('moves transactions, due dates, rules and imported items, then removes the category', () => {
    const d = make(), next = deleteCategory(d, 'pets', 'groceries', AT)!
    expect(next.settings.categories.some(c => c.id === 'pets')).toBe(false)
    expect(next.settings.events.map(e => [e.id, e.category])).toEqual([['vet', 'groceries'], ['rent', 'rent']])   // nothing deleted
    expect(next.transactions).toEqual([{ ...d.transactions[0], category: 'groceries', updatedAt: AT }, d.transactions[1]])
    expect(next.settings.rules?.[0].category).toBe('groceries'); expect(next.inbox?.[0].category).toBe('groceries')
    expect(next.settingsUpdatedAt).toBe(AT); expect(dangling(next)).toEqual([])
  })
  it('the starting rules become the user\'s own only when they referred to the deleted category', () => {
    const seedCategory = seedRules()[0].category
    const base = make(), seeded: AppData = { ...base, transactions: [], inbox: [], settings: { ...base.settings, rules: undefined, events: [] } }
    const target = moveTargets(seeded, seedCategory)[0].id
    const moved = deleteCategory(seeded, seedCategory, target, AT)!
    expect(moved.settings.rules?.length).toBe(seedRules().length); expect(dangling(moved)).toEqual([])
    expect(deleteCategory(seeded, 'pets', null, AT)?.settings.rules).toBeUndefined()
  })
  it('an unused category is removed without touching anything else', () => {
    const d = make(), unused = deleteCategory(deleteCategory(d, 'pets', 'groceries', AT)!, 'groceries', null, AT)
    expect(unused).toBeNull()                                                   // groceries is now used: a target is required
    const empty = deleteCategory(d, 'gifts', null, AT)
    expect(empty?.transactions).toBe(d.transactions); expect(empty?.settings.events).toBe(d.settings.events)
  })
  it.each([
    ['no target while in use', 'pets', null],
    ['a target of another type', 'pets', 'salary'],
    ['itself as target', 'pets', 'pets'],
    ['a category that does not exist', 'nope', 'groceries'],
    ['a target that does not exist', 'pets', 'nope'],
  ])('refuses %s and changes nothing', (_, id, moveTo) => {
    const d = make()
    expect(deleteCategory(d, id as string, moveTo as string | null, AT)).toBeNull()
    const state = { loaded: true, data: d }
    expect(reducer(state, { type: 'deleteCategory', id: id as string, moveTo: moveTo as string | null, at: AT })).toBe(state)
  })
  it('offers only categories of the same type as targets', () => {
    const d = make()
    expect(moveTargets(d, 'pets').every(c => c.type === 'expense' && c.id !== 'pets')).toBe(true)
    expect(moveTargets(d, 'salary').every(c => c.type === 'income')).toBe(true)
  })
  it('works through the reducer, as the settings screen does', () => {
    const next = reducer({ loaded: true, data: make() }, { type: 'deleteCategory', id: 'pets', moveTo: 'groceries', at: AT }).data!
    expect(next).toEqual(deleteCategory(make(), 'pets', 'groceries', AT))
  })
})

describe('deleting a category while another device keeps working (CAS v2 merge)', () => {
  const base = make()
  const phone = deleteCategory(base, 'pets', 'groceries', AT)!               // the phone deletes «Animali», moving everything
  const conflict = (pc: AppData, r: ReturnType<typeof reconcile>): DataConflict => ({ id: 'c', paths: r.paths,
    base: { protocol: 2, mode: 'protected', revision: '1', document: base }, local: pc, remote: { protocol: 2, mode: 'protected', revision: '2', document: phone } })
  it('a transaction added in that category on the PC keeps the category alive: no invalid reference', () => {
    const pc = reducer({ loaded: true, data: clone(base) }, { type: 'addTx', at: '2026-10-26T10:01:00.000Z',
      tx: { id: 't3', date: '2026-10-26', description: 'Crocchette', category: 'pets', amount: 12 } }).data!
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([]); expect(dangling(r.document!)).toEqual([])
    expect(r.document!.transactions.find(t => t.id === 't1')?.category).toBe('groceries')
    expect(r.document!.transactions.find(t => t.id === 't3')?.category).toBe('pets')
  })
  it('a due date of that category edited on the PC keeps the edit and follows the move', () => {
    const pc = clone(base); pc.settings.events[0].amount = 12.99
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([]); expect(r.document!.settings.events[0]).toMatchObject({ id: 'vet', amount: 12.99, category: 'groceries' })
    expect(dangling(r.document!)).toEqual([])
  })
  it('a rename on the PC against the deletion on the phone is asked; either answer leaves no invalid reference', () => {
    const pc = clone(base); pc.settings.categories = pc.settings.categories.map(c => c.id === 'pets' ? { ...c, name: 'Cane' } : c)
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual(['/settings/categories/pets'])
    for (const side of ['local', 'remote'] as const) expect(dangling(resolveConflict(conflict(pc, r), { '/settings/categories/pets': side })!)).toEqual([])
  })
  it('an old copy that never saw the deletion cannot bring back the deleted items as separate copies', () => {
    const pc = clone(base)                                                       // unchanged old copy
    expect(reconcile(base, pc, phone).document).toEqual(phone)
  })
})
