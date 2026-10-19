import { afterEach, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import { FxAutoUpdate } from './FxAutoUpdate'
const probe = vi.hoisted(() => ({ effect: (() => {}) as () => void, store: null as unknown, rates: vi.fn() }))
vi.mock('react', () => ({ useRef: () => ({ current: '' }), useEffect: (effect: () => void) => { probe.effect = effect } }))
vi.mock('../store/context', () => ({ useStore: () => probe.store }))
vi.mock('../fx', () => ({ neededCurrencies: () => ['USD'], fetchRates: (...args: unknown[]) => probe.rates(...args) }))
afterEach(() => vi.unstubAllGlobals())

it.each(['same currency', 'changed currency'])('a late rate response respects the current account settings: %s', async kind => {
  const data = { version: 1, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }), transactions: [] }
  data.settings.currency = 'EUR'
  let latest = data, finish!: (v: unknown) => void
  const dispatch = vi.fn()
  probe.rates.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  probe.store = { state: { loaded: true, data }, dispatch, lease: { current: () => true },
    storage: { getSnapshot: () => ({ state: { data: latest } }) } }
  vi.stubGlobal('navigator', { onLine: true })
  FxAutoUpdate({ today: '2026-10-19' }); probe.effect()
  latest = { ...data, settings: { ...data.settings, monthStartDay: 7, currency: kind === 'changed currency' ? 'USD' : 'EUR' } }
  finish({ rates: { USD: 1.2 }, date: '2026-10-19' }); await Promise.resolve()
  if (kind === 'changed currency') expect(dispatch).not.toHaveBeenCalled()
  else expect(dispatch).toHaveBeenCalledWith({ type: 'setSettings', settings: { ...latest.settings, fxRates: { ...latest.settings.fxRates, USD: 1.2 }, fxDate: '2026-10-19' } })
})
