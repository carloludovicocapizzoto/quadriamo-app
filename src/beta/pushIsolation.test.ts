import { afterEach, expect, it, vi } from 'vitest'
import { activateScope, personalKey } from '../store/scope'
import { enablePush, quarantinePersonalPush, syncPush } from './push'
import { saveMorningSnapshot } from './morning'
import { syncReminders } from './reminders'

const db = vi.hoisted(() => ({ set: vi.fn(async () => {}) }))
vi.mock('idb-keyval', () => ({ set: (...args: unknown[]) => db.set(...args as []) }))
afterEach(() => { vi.unstubAllGlobals(); db.set.mockClear() })
it('retires the old endpoint and visible notifications locally without registering a new one', async () => {
  const close = vi.fn(), unsubscribe = vi.fn(async () => true), unregister = vi.fn(async () => true)
  vi.stubGlobal('location', { origin: 'http://synthetic.invalid' })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => [{
    scope: 'http://synthetic.invalid/', active: { scriptURL: 'http://synthetic.invalid/sw.js' },
    getNotifications: async () => [{ close }], pushManager: { getSubscription: async () => ({ unsubscribe }) }, unregister,
  }] } })
  await quarantinePersonalPush()
  expect(close).toHaveBeenCalled()
  expect(unsubscribe).toHaveBeenCalled()
  expect(unregister).toHaveBeenCalled()
  expect(await enablePush('it')).toBe(false)
  await syncPush('it')
})
it('keeps personal reminder snapshots out of every legacy global key and out of demo', async () => {
  const lease = activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'A' })
  await saveMorningSnapshot(null)
  await syncReminders([], { morning: true, news: true, nudge: true, reminders: true } as never, 'EUR', 'it')
  expect(db.set.mock.calls.map(c => (c as unknown[])[0])).toEqual([
    personalKey('quadriamo.morning', lease.scope), personalKey('quadriamo.reminders', lease.scope),
  ])
  db.set.mockClear()
  activateScope({ ...lease.scope, kind: 'demo' })
  await saveMorningSnapshot(null)
  await syncReminders([], {} as never, 'EUR', 'it')
  expect(db.set).not.toHaveBeenCalled()
})

it('does not swallow a failed retirement or pretend that isolation is safe', async () => {
  const { pushIsolationSnapshot } = await import('./push')
  vi.stubGlobal('location', { origin: 'http://synthetic.invalid' })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => [{
    scope: 'http://synthetic.invalid/', active: { scriptURL: 'http://synthetic.invalid/sw.js' },
    getNotifications: async () => [], pushManager: { getSubscription: async () => ({ unsubscribe: async () => false }) },
    unregister: async () => false,
  }] } })
  await expect(quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
  expect(pushIsolationSnapshot()).toBe('error')
})
it('does not retire workers or notifications outside this application scope', async () => {
  const unregister = vi.fn(), getNotifications = vi.fn()
  vi.stubGlobal('location', { origin: 'http://synthetic.invalid' })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => [{
    scope: 'http://synthetic.invalid/another-app/', active: { scriptURL: 'http://synthetic.invalid/another-app/sw.js' },
    unregister, getNotifications,
  }] } })
  await quarantinePersonalPush()
  expect(unregister).not.toHaveBeenCalled(); expect(getNotifications).not.toHaveBeenCalled()
})
