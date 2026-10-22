import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import { reducer } from '../store/reducer'
import type { Action, AppData } from '../store/types'
import { FxAutoUpdate } from './FxAutoUpdate'
const probe = vi.hoisted(() => ({ effect: (() => {}) as () => void, store: null as unknown, rates: vi.fn() }))
vi.mock('react', () => ({ useRef: () => ({ current: '' }), useEffect: (effect: () => void) => { probe.effect = effect } }))
vi.mock('../store/context', () => ({ useStore: () => probe.store }))
vi.mock('../fx', () => ({ neededCurrencies: () => ['USD'], fetchRates: (...args: unknown[]) => probe.rates(...args) }))

const make = (over: Partial<AppData['settings']> = {}): AppData => {
  const settings = { ...defaultSettings({ firstMonth: { year: 2026, month: 10 } }), currency: 'EUR', ...over }
  return { version: 1, settings, transactions: [], settingsUpdatedAt: '2026-10-01T08:00:00.000Z' }
}
const saved = new Map<string, string>()
let dispatch = vi.fn()
/** One mount of the component on `data`; returns the function that delivers the network response. */
function mount(data: AppData, today: string, owner = 'A') {
  let finish!: (v: unknown) => void
  probe.rates.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  probe.store = { state: { loaded: true, data }, dispatch, lease: { current: () => true, scope: { kind: 'account', owner } } }
  FxAutoUpdate({ today }); probe.effect()
  return async (rates: Record<string, number>, date: string) => { finish({ rates, date }); await Promise.resolve(); await Promise.resolve() }
}
const apply = (data: AppData) => (dispatch.mock.calls as [Action][]).reduce((d, [a]) => reducer({ loaded: true, data: d }, a).data!, data)
beforeEach(() => {
  saved.clear(); dispatch = vi.fn(); probe.rates.mockReset()
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('localStorage', { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v) } })
})
afterEach(() => vi.unstubAllGlobals())

it('stores the real date of the rates, not today, and does not count as a user change', async () => {
  const data = make()
  await mount(data, '2026-10-18')({ USD: 1.2 }, '2026-10-16')          // Sunday: the ECB rates are Friday's
  expect(dispatch).toHaveBeenCalledWith({ type: 'setFx', currency: 'EUR', rates: { USD: 1.2 }, date: '2026-10-16' })
  // meanwhile the user changed other settings (or another device's copy arrived): those stay, the timestamp does not move
  const latest = { ...data, settings: { ...data.settings, monthStartDay: 7 } }
  expect(apply(latest)).toEqual({ ...latest, settings: { ...latest.settings, fxRates: { ...latest.settings.fxRates, USD: 1.2 }, fxDate: '2026-10-16' } })
})
it('on a weekend the rates are downloaded once per day and account, not at every opening', async () => {
  const data = make()
  await mount(data, '2026-10-18')({ USD: 1.2 }, '2026-10-16')
  const after = apply(data)
  mount(after, '2026-10-18')
  expect(probe.rates).toHaveBeenCalledTimes(1)
  mount(after, '2026-10-18', 'B')                                         // another account on the same device checks for itself
  mount(after, '2026-10-19')                                              // Monday: a new check
  expect(probe.rates).toHaveBeenCalledTimes(3)
})
it('a failed download is retried at the next opening', async () => {
  probe.rates.mockImplementationOnce(() => Promise.reject(Error('offline')))
  probe.store = { state: { loaded: true, data: make() }, dispatch, lease: { current: () => true, scope: { kind: 'account', owner: 'A' } } }
  FxAutoUpdate({ today: '2026-10-19' }); probe.effect(); await Promise.resolve(); await Promise.resolve()
  mount(make(), '2026-10-19')
  expect(probe.rates).toHaveBeenCalledTimes(2); expect(dispatch).not.toHaveBeenCalled()
})
it('responses arriving out of order: the older rates never replace newer ones', async () => {
  const data = make()
  const older = mount(data, '2026-10-19'), newer = mount(data, '2026-10-20')   // e.g. two windows, or a slow network
  await newer({ USD: 1.25 }, '2026-10-20'); await older({ USD: 1.2 }, '2026-10-19')
  expect(apply(data).settings).toMatchObject({ fxRates: { USD: 1.25 }, fxDate: '2026-10-20' })
  const sameDay = mount(data, '2026-10-20'), sameDayLater = mount(data, '2026-10-20')
  dispatch.mockClear(); await sameDay({ USD: 1.25 }, '2026-10-20'); await sameDayLater({ USD: 1.26 }, '2026-10-20')
  expect(apply(data).settings.fxRates.USD).toBe(1.26)                      // same date: the last answer wins
})
it('a late response for a currency the user has just changed is ignored', async () => {
  const data = make()
  const late = mount(data, '2026-10-19')
  await late({ USD: 1.2 }, '2026-10-19')
  const usd = { ...data, settings: { ...data.settings, currency: 'USD' } }
  expect(apply(usd)).toBe(usd)
})
it('a response without a date changes nothing', async () => {
  await mount(make(), '2026-10-19')({}, '')
  expect(dispatch).not.toHaveBeenCalled()
})
