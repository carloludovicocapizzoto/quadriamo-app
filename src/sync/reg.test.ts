// REG: the 2026-10-21 subscription loss (old PC copy + automatic exchange rates + sync) and its neighbours.
// Three-way merge only; the full CAS cycle with two devices is in runSync.test.ts ("REG").
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../engine'
import { withPriceChange, type CalEvent } from '../engine/calendar'
import { reducer } from '../store/reducer'
import type { Action, AppData } from '../store/types'
import { clone, EVENT, reconcile, resolveConflict, type DataConflict } from './protocol'

const event = (id: string, title: string, kind = 'subscription'): CalEvent => ({ id, kind, title, amount: 9.99, category: 'fixedCosts', date: '2026-10-05',
  repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true }) as CalEvent
const start = (): AppData => {
  const s = defaultSettings({ firstMonth: { year: 2026, month: 10 } })
  return { version: 1, settings: { ...s, events: [event('rent', 'Affitto', 'payment')] }, settingsUpdatedAt: '2026-10-01T08:00:00.000Z', transactions: [] }
}
const act = (d: AppData, a: Action) => reducer({ loaded: true, data: d }, a).data!
const titles = (d: AppData | null) => (d?.settings.events ?? []).map(e => e.title).sort()
const fx = (d: AppData, date: string, USD = 1.08) => act(d, { type: 'setFx', currency: d.settings.currency, rates: { USD }, date })
const events = (d: AppData, at: string, change: (list: CalEvent[]) => CalEvent[]) =>
  act(d, { type: 'setSettings', at, settings: { ...d.settings, events: change(structuredClone(d.settings.events)) } })
const addSubs = (d: AppData, at = '2026-10-20T10:00:00.000Z') => events(d, at, list => [...list, event('s1', 'Netflix'), event('s2', 'Spotify')])

describe('REG: old copy + automatic exchange rates + sync', () => {
  const base = start(), phone = addSubs(base)                // r1 known by both; r2 = the phone adds two subscriptions
  it('1. rates updated BEFORE the PC reads the cloud: both survive, no conflict', () => {
    const pc = fx(clone(base), '2026-10-21')
    expect(pc.settingsUpdatedAt).toBe(base.settingsUpdatedAt)     // a download is not a user edit
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([]); expect(titles(r.document)).toEqual(['Affitto', 'Netflix', 'Spotify'])
    expect(r.document?.settings).toMatchObject({ fxRates: { USD: 1.08 }, fxDate: '2026-10-21' })
  })
  it('1b. same, with a client that still stamps settingsUpdatedAt (rates via setSettings)', () => {
    const pc = act(clone(base), { type: 'setSettings', at: '2026-10-21T13:35:00.000Z', settings: { ...base.settings, fxRates: { USD: 1.08 }, fxDate: '2026-10-21' } })
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([]); expect(titles(r.document)).toEqual(['Affitto', 'Netflix', 'Spotify'])
    expect(r.document?.settingsUpdatedAt).toBe('2026-10-21T13:35:00.000Z')
  })
  it('2. rates updated AFTER the read: subscriptions kept', () => {
    const synced = reconcile(base, clone(base), phone).document!
    const r = reconcile(phone, fx(synced, '2026-10-21'), phone)
    expect(r.paths).toEqual([]); expect(titles(r.document)).toEqual(['Affitto', 'Netflix', 'Spotify'])
  })
  it('3. a real conflict asks only about that event: choosing "this device" cannot erase the other subscriptions', () => {
    const pc = events(fx(clone(base), '2026-10-21'), '2026-10-21T13:36:00.000Z', list => [...list, { ...event('s1', 'Netflix'), amount: 12.99 }])
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([EVENT + 's1']); expect(titles(r.document)).toEqual(['Affitto', 'Spotify'])
    const conflict: DataConflict = { id: 'c', paths: r.paths, base: { protocol: 2, mode: 'protected', revision: '1', document: base }, local: pc,
      remote: { protocol: 2, mode: 'protected', revision: '2', document: phone } }
    const chosen = resolveConflict(conflict, { [EVENT + 's1']: 'local' })!
    expect(titles(chosen)).toEqual(['Affitto', 'Netflix', 'Spotify'])
    expect(chosen.settings.events.find(e => e.id === 's1')?.amount).toBe(12.99)
    expect(chosen.settings.fxDate).toBe('2026-10-21')
  })
  it('4. both devices refresh the rates on the same day: no conflict, the most recent download wins', () => {
    const r = reconcile(base, fx(clone(base), '2026-10-22', 1.09), fx(clone(base), '2026-10-22', 1.08))
    expect(r.paths).toEqual([]); expect(r.document?.settings.fxRates.USD).toBe(1.08)          // tie → the cloud copy
    const newer = reconcile(base, fx(clone(base), '2026-10-23', 1.1), fx(clone(base), '2026-10-22', 1.08))
    expect(newer.document?.settings).toMatchObject({ fxRates: { USD: 1.1 }, fxDate: '2026-10-23' })
  })
})

describe('REG: calendar events merge one by one', () => {
  const base = addSubs(start())
  it('a removal on the phone stays removed even if the PC only refreshed the rates', () => {
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.filter(e => e.id !== 's1'))
    const r = reconcile(base, fx(clone(base), '2026-10-21'), phone)
    expect(r.paths).toEqual([]); expect(titles(r.document)).toEqual(['Affitto', 'Spotify'])
  })
  it('a removal on one device and an edit on the other is asked, never decided silently', () => {
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.filter(e => e.id !== 's1'))
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 's1' ? { ...e, amount: 12.99 } : e))
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([EVENT + 's1']); expect(titles(r.document)).toEqual(['Affitto', 'Spotify'])
  })
  it('additions on both devices are kept', () => {
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => [...list, event('a', 'Bolletta luce', 'bill')])
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => [...list, event('b', 'Carta d’identità', 'document')])
    expect(titles(reconcile(base, pc, phone).document)).toEqual(['Affitto', 'Bolletta luce', 'Carta d’identità', 'Netflix', 'Spotify'])
  })
  it('edits of different fields of the same event combine; paid dates merge as a set, un-marking included', () => {
    const marked = events(base, '2026-10-02T09:00:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, done: ['2026-09-05'] } : e))
    const phone = events(marked, '2026-10-05T09:00:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, done: ['2026-09-05', '2026-10-05'] } : e))
    const pc = events(marked, '2026-10-05T10:00:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, done: [], title: 'Spotify Duo' } : e))
    const r = reconcile(marked, pc, phone)
    expect(r.paths).toEqual([]); expect(r.document?.settings.events.find(e => e.id === 's2')).toMatchObject({ title: 'Spotify Duo', done: ['2026-10-05'] })
  })
  it.each(['local', 'remote'] as const)('a price change on both devices asks only the amount; the price history follows the choice (%s)', side => {
    const price = (amount: number, day: string) => (list: CalEvent[]) => list.map(e => e.id === 's1' ? withPriceChange(e, { ...e, amount }, day) : e)
    const phone = events(base, '2026-10-21T09:00:00.000Z', price(13.99, '2026-10-21'))
    const pc = events(base, '2026-10-21T09:05:00.000Z', price(14.99, '2026-10-21'))
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([EVENT + 's1/amount'])
    const chosen = resolveConflict({ id: 'c', paths: r.paths, base: { protocol: 2, mode: 'protected', revision: '1', document: base }, local: pc,
      remote: { protocol: 2, mode: 'protected', revision: '2', document: phone } }, { [EVENT + 's1/amount']: side })!
    const s1 = chosen.settings.events.find(e => e.id === 's1')!
    expect(s1.amount).toBe(side === 'local' ? 14.99 : 13.99); expect(s1.prices).toEqual([{ date: '2026-10-21', from: 9.99, to: s1.amount }])
  })
  it.each(['local', 'remote'] as const)('amount removed on one device, changed on the other: the history never keeps the discarded price (%s)', side => {
    // il telefono porta l'importo a 12,99 (lo storico registra 9,99 → 12,99); il PC lo toglie (storico invariato)
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.map(e => e.id === 's1' ? withPriceChange(e, { ...e, amount: 12.99 }, '2026-10-21') : e))
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 's1' ? withPriceChange(e, { ...e, amount: null }, '2026-10-21') : e))
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([EVENT + 's1/amount'])
    const chosen = resolveConflict({ id: 'c', paths: r.paths, base: { protocol: 2, mode: 'protected', revision: '1', document: base }, local: pc,
      remote: { protocol: 2, mode: 'protected', revision: '2', document: phone } }, { [EVENT + 's1/amount']: side })!
    const s1 = chosen.settings.events.find(e => e.id === 's1')!
    if (side === 'local') { expect(s1.amount).toBeNull(); expect(s1.prices ?? []).toEqual([]) }
    else { expect(s1.amount).toBe(12.99); expect(s1.prices).toEqual([{ date: '2026-10-21', from: 9.99, to: 12.99 }]) }
  })
  it('the history follows the amount even when only the other device touched the history', () => {
    // il telefono cambia prezzo e poi lo rimette com'era (due righe di storico, importo uguale all'inizio); il PC toglie l'importo
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.map(e => {
      if (e.id !== 's1') return e
      const up = withPriceChange(e, { ...e, amount: 13.99 }, '2026-10-20')
      return withPriceChange(up, { ...up, amount: 9.99 }, '2026-10-21')
    }))
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 's1' ? { ...e, amount: null } : e))
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([])
    const s1 = r.document!.settings.events.find(e => e.id === 's1')!
    expect(s1.amount).toBeNull(); expect(s1.prices ?? []).toEqual([])
  })
  it('the same field changed differently stays a question about that event', () => {
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, amount: 10.99 } : e))
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, amount: 11.99 } : e))
    expect(reconcile(base, pc, phone).paths).toEqual([EVENT + 's2/amount'])
  })
  it.each(['local', 'remote'] as const)('same field in conflict plus independent fields: choosing %s for the field keeps both sides\' other edits', side => {
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.map(e => e.id === 's1' ? { ...e, amount: 13.99, title: 'Netflix Premium' } : e))
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 's1' ? { ...e, amount: 12.99, reminders: [{ days: 3 }] } : e))
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual([EVENT + 's1/amount'])
    const chosen = resolveConflict({ id: 'c', paths: r.paths, base: { protocol: 2, mode: 'protected', revision: '1', document: base }, local: pc,
      remote: { protocol: 2, mode: 'protected', revision: '2', document: phone } }, { [EVENT + 's1/amount']: side })!
    expect(chosen.settings.events.find(e => e.id === 's1')).toMatchObject({ amount: side === 'local' ? 12.99 : 13.99, title: 'Netflix Premium', reminders: [{ days: 3 }] })
    expect(titles(chosen)).toEqual(['Affitto', 'Netflix Premium', 'Spotify'])
  })
  it('rates follow the merged currency: a stale refresh in the old currency is not mixed in', () => {
    const phone = act(base, { type: 'setSettings', at: '2026-10-21T09:00:00.000Z', settings: { ...base.settings, currency: 'USD', fxRates: { EUR: 0.92 }, fxDate: '2026-10-21' } })
    const r = reconcile(base, fx(clone(base), '2026-10-22', 1.08), phone)
    expect(r.paths).toEqual([]); expect(r.document?.settings).toMatchObject({ currency: 'USD', fxRates: { EUR: 0.92 }, fxDate: '2026-10-21' })
    expect(r.document?.settings.fxRates.USD).toBeUndefined()
  })
  it('other settings merge field by field; a real clash is asked only for that field', () => {
    const phone = act(base, { type: 'setSettings', at: '2026-10-21T09:00:00.000Z', settings: { ...base.settings, monthStartDay: 27 } })
    const pc = act(base, { type: 'setSettings', at: '2026-10-21T09:05:00.000Z', settings: { ...base.settings, homeFavs: ['spend'] } })
    expect(reconcile(base, pc, phone).document?.settings).toMatchObject({ monthStartDay: 27, homeFavs: ['spend'] })
  })
})

describe('REG: a conflict on another setting never costs the subscriptions', () => {
  const base = start()
  // the phone adds two subscriptions and sets the month start to the 27th; the old PC sets it to the 10th
  const phone = act(addSubs(base), { type: 'setSettings', at: '2026-10-21T09:00:00.000Z', settings: { ...addSubs(base).settings, monthStartDay: 27 } })
  const pc = act(fx(clone(base), '2026-10-21'), { type: 'setSettings', at: '2026-10-21T09:05:00.000Z', settings: { ...fx(clone(base), '2026-10-21').settings, monthStartDay: 10 } })
  const conflict = (r: ReturnType<typeof reconcile>): DataConflict => ({ id: 'c', paths: r.paths, base: { protocol: 2, mode: 'protected', revision: '1', document: base },
    local: pc, remote: { protocol: 2, mode: 'protected', revision: '2', document: phone } })
  it('only the conflicting field is asked, everything else is already merged', () => {
    const r = reconcile(base, pc, phone)
    expect(r.paths).toEqual(['/settings/monthStartDay'])
    expect(titles(r.document)).toEqual(['Affitto', 'Netflix', 'Spotify']); expect(r.document?.settings.fxDate).toBe('2026-10-21')
  })
  it.each(['local', 'remote'] as const)('choosing %s for that field keeps the subscriptions that exist only in the cloud', side => {
    const chosen = resolveConflict(conflict(reconcile(base, pc, phone)), { '/settings/monthStartDay': side })!
    expect(chosen.settings.monthStartDay).toBe(side === 'local' ? 10 : 27)
    expect(titles(chosen)).toEqual(['Affitto', 'Netflix', 'Spotify']); expect(chosen.settings.fxDate).toBe('2026-10-21')
  })
  it('a currency clash: the chosen currency brings its own rates', () => {
    const p = act(phone, { type: 'setSettings', at: '2026-10-21T09:10:00.000Z', settings: { ...phone.settings, currency: 'USD', fxRates: { EUR: 0.92 }, fxDate: '2026-10-21' } })
    const c = act(pc, { type: 'setSettings', at: '2026-10-21T09:11:00.000Z', settings: { ...pc.settings, currency: 'GBP', fxRates: { EUR: 1.15 }, fxDate: '2026-10-20' } })
    const r = reconcile(base, c, p)
    expect(r.paths.sort()).toEqual(['/settings/currency', '/settings/monthStartDay'])
    const chosen = resolveConflict({ ...conflict(r), local: c, remote: { protocol: 2, mode: 'protected', revision: '2', document: p } },
      { '/settings/monthStartDay': 'local', '/settings/currency': 'remote' })!
    expect(chosen.settings).toMatchObject({ currency: 'USD', fxRates: { EUR: 0.92 }, fxDate: '2026-10-21', monthStartDay: 10 })
    expect(titles(chosen)).toEqual(['Affitto', 'Netflix', 'Spotify'])
  })
  it('the active days and the goals merge without a whole-document question', () => {
    const goal = (id: string) => ({ id, name: id, target: 100, contributions: [] }) as never
    const b = { ...base, activity: ['2026-10-01', '2026-10-02'] }
    const l = { ...b, activity: ['2026-10-01', '2026-10-02', '2026-10-21'], goals: [goal('bike')] }
    const r = { ...b, activity: ['2026-10-02', '2026-10-22'], goals: [goal('trip')] }       // the other copy trimmed an old day
    const merged = reconcile(b, l, r)
    expect(merged.paths).toEqual([]); expect(merged.document?.activity).toEqual(['2026-10-02', '2026-10-21', '2026-10-22'])
    expect(merged.document?.goals?.map(g => g.id)).toEqual(['bike', 'trip'])
  })
})

describe('REG: a category removed on one device while the other uses it', () => {
  const base = start()
  const pet = { id: 'pets', name: 'Animali', type: 'expense' as const, defaultBucket: base.settings.buckets[0].id }
  const withPets = act(base, { type: 'setSettings', at: '2026-10-02T08:00:00.000Z', settings: { ...base.settings, categories: [...base.settings.categories, pet],
    events: [...base.settings.events, { ...event('vet', 'Assicurazione cane', 'payment'), category: 'pets' }] } })
  // what Categories.tsx does today: removes the category and its events
  const removed = act(withPets, { type: 'setSettings', at: '2026-10-21T09:00:00.000Z', settings: { ...withPets.settings,
    categories: withPets.settings.categories.filter(c => c.id !== 'pets'), events: withPets.settings.events.filter(e => e.category !== 'pets') } })
  it('a new event in that category brings the category back instead of pointing to nothing', () => {
    const added = events(withPets, '2026-10-21T09:05:00.000Z', list => [...list, { ...event('food', 'Crocchette'), category: 'pets' }])
    const r = reconcile(withPets, removed, added)
    expect(r.paths).toEqual([]); expect(titles(r.document)).toEqual(['Affitto', 'Crocchette'])
    expect(r.document?.settings.categories.some(c => c.id === 'pets')).toBe(true)
  })
  it('a new transaction in that category also keeps it', () => {
    const added = act(withPets, { type: 'addTx', at: '2026-10-21T09:05:00.000Z', tx: { id: 't1', date: '2026-10-21', description: 'Veterinario', category: 'pets', amount: -40 } })
    expect(reconcile(withPets, removed, added).document?.settings.categories.some(c => c.id === 'pets')).toBe(true)
  })
  it('untouched old items do not revive a removed category', () => {
    const other = fx(clone(withPets), '2026-10-21')
    const r = reconcile(withPets, removed, other)
    expect(r.paths).toEqual([]); expect(r.document?.settings.categories.some(c => c.id === 'pets')).toBe(false); expect(titles(r.document)).toEqual(['Affitto'])
  })
  it('an edit of an event whose category was removed is asked; keeping it keeps its category', () => {
    const edited = events(withPets, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 'vet' ? { ...e, amount: 30 } : e))
    const r = reconcile(withPets, removed, edited)
    expect(r.paths).toEqual([EVENT + 'vet'])
    const chosen = resolveConflict({ id: 'c', paths: r.paths, base: { protocol: 2, mode: 'protected', revision: '1', document: withPets }, local: removed,
      remote: { protocol: 2, mode: 'protected', revision: '2', document: edited } }, { [EVENT + 'vet']: 'remote' })!
    expect(titles(chosen)).toEqual(['Affitto', 'Assicurazione cane']); expect(chosen.settings.categories.some(c => c.id === 'pets')).toBe(true)
  })
})
