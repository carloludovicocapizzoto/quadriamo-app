import { afterEach, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import { reducer } from '../store/reducer'
import { FxAutoUpdate } from './FxAutoUpdate'
const probe = vi.hoisted(() => ({ effect: (() => {}) as () => void, store: null as unknown, rates: vi.fn() }))
vi.mock('react', () => ({ useRef: () => ({ current: '' }), useEffect: (effect: () => void) => { probe.effect = effect } }))
vi.mock('../store/context', () => ({ useStore: () => probe.store }))
vi.mock('../fx', () => ({ neededCurrencies: () => ['USD'], fetchRates: (...args: unknown[]) => probe.rates(...args) }))
afterEach(() => vi.unstubAllGlobals())

it('a late rate response is applied by the reducer to the current settings, without counting as a user change', async () => {
  const data = { version: 1 as const, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }), transactions: [], settingsUpdatedAt: '2026-10-01T08:00:00.000Z' }
  data.settings.currency = 'EUR'
  let finish!: (v: unknown) => void
  const dispatch = vi.fn()
  probe.rates.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  probe.store = { state: { loaded: true, data }, dispatch, lease: { current: () => true } }
  vi.stubGlobal('navigator', { onLine: true })
  FxAutoUpdate({ today: '2026-10-19' }); probe.effect()
  finish({ rates: { USD: 1.2 }, date: '2026-10-19' }); await Promise.resolve()
  const action = { type: 'setFx', currency: 'EUR', rates: { USD: 1.2 }, date: '2026-10-19' } as const
  expect(dispatch).toHaveBeenCalledWith(action)
  // meanwhile the user changed other settings (or another device's copy arrived): those stay, the timestamp does not move
  const latest = { ...data, settings: { ...data.settings, monthStartDay: 7 } }
  expect(reducer({ loaded: true, data: latest }, action).data).toEqual({ ...latest, settings: { ...latest.settings, fxRates: { ...latest.settings.fxRates, USD: 1.2 }, fxDate: '2026-10-19' } })
  const usd = { ...data, settings: { ...data.settings, currency: 'USD' } }
  expect(reducer({ loaded: true, data: usd }, action).data).toBe(usd)
})
