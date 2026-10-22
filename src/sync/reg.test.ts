// REG: the 2026-10-21 subscription loss (old PC copy + automatic exchange rates + sync) and its neighbours.
// Three-way merge only; the full CAS cycle with two devices is in runSync.test.ts ("REG").
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../engine'
import type { CalEvent } from '../engine/calendar'
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
  it('the same field changed differently stays a question about that event', () => {
    const phone = events(base, '2026-10-21T09:00:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, amount: 10.99 } : e))
    const pc = events(base, '2026-10-21T09:05:00.000Z', list => list.map(e => e.id === 's2' ? { ...e, amount: 11.99 } : e))
    expect(reconcile(base, pc, phone).paths).toEqual([EVENT + 's2'])
  })
  it('rates follow the merged currency: a stale refresh in the old currency is not mixed in', () => {
    const phone = act(base, { type: 'setSettings', at: '2026-10-21T09:00:00.000Z', settings: { ...base.settings, currency: 'USD', fxRates: { EUR: 0.92 }, fxDate: '2026-10-21' } })
    const r = reconcile(base, fx(clone(base), '2026-10-22', 1.08), phone)
    expect(r.paths).toEqual([]); expect(r.document?.settings).toMatchObject({ currency: 'USD', fxRates: { EUR: 0.92 }, fxDate: '2026-10-21' })
    expect(r.document?.settings.fxRates.USD).toBeUndefined()
  })
  it('other settings still use a three-way choice per field, and a real clash is still a whole-document question', () => {
    const phone = act(base, { type: 'setSettings', at: '2026-10-21T09:00:00.000Z', settings: { ...base.settings, monthStartDay: 27 } })
    const pc = act(base, { type: 'setSettings', at: '2026-10-21T09:05:00.000Z', settings: { ...base.settings, homeFavs: ['spend'] } })
    expect(reconcile(base, pc, phone).document?.settings).toMatchObject({ monthStartDay: 27, homeFavs: ['spend'] })
    const clash = act(base, { type: 'setSettings', at: '2026-10-21T09:05:00.000Z', settings: { ...base.settings, monthStartDay: 10 } })
    expect(reconcile(base, clash, phone)).toEqual({ document: null, paths: ['/document'] })
  })
})
