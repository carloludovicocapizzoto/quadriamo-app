import { afterEach, expect, it, vi } from 'vitest'
import { activateScope, personalKey } from '../store/scope'
import { saveMorningSnapshot } from './morning'
import { syncReminders } from './reminders'

const ORIGIN = 'http://synthetic.invalid'
const SCOPE = `${ORIGIN}/`
const db = vi.hoisted(() => ({ set: vi.fn(async () => {}) }))
vi.mock('idb-keyval', () => ({ set: (...args: unknown[]) => db.set(...args as []) }))

function registration(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    active: { scriptURL: `${SCOPE}sw-account-v2.js` },
    waiting: null,
    installing: null,
    getNotifications: async () => [],
    pushManager: { getSubscription: async () => null },
    unregister: async () => true,
    ...overrides,
  } as unknown as ServiceWorkerRegistration
}

function install(registrations: ServiceWorkerRegistration[]) {
  const getRegistrations = vi.fn(async () => registrations)
  vi.stubGlobal('location', { origin: ORIGIN })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations } })
  return getRegistrations
}

afterEach(() => { vi.unstubAllGlobals(); db.set.mockClear(); vi.resetModules() })

it('treats the recognized Alpha worker as safe when optional push APIs are absent', async () => {
  const { ENV } = await import('../env')
  ENV.name = 'alpha'
  const unregister = vi.fn(async () => true)
  install([registration({ getNotifications: undefined, pushManager: undefined, unregister })])
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  await quarantinePersonalPush()
  expect(pushIsolationSnapshot()).toBe('safe')
  expect(unregister).not.toHaveBeenCalled()
})

it('fails closed for missing cleanup APIs on the historical production origin', async () => {
  const { ENV } = await import('../env')
  const previous = ENV.name
  ENV.name = 'production'
  try {
    install([registration({ getNotifications: undefined, pushManager: undefined })])
    const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
    await expect(quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
    expect(pushIsolationSnapshot()).toBe('error')
  } finally { ENV.name = previous }
})

it('does not retire an in-progress registration before a worker is activated', async () => {
  const { ENV } = await import('../env')
  ENV.name = 'alpha'
  const unregister = vi.fn(async () => true)
  install([registration({ active: null, waiting: null, installing: null, getNotifications: undefined, pushManager: undefined, unregister })])
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  await quarantinePersonalPush()
  expect(pushIsolationSnapshot()).toBe('safe')
  expect(unregister).not.toHaveBeenCalled()
})

it('retires a legacy worker and closes its subscription and visible notifications', async () => {
  const close = vi.fn(), unsubscribe = vi.fn(async () => true), unregister = vi.fn(async () => true)
  install([registration({
    active: { scriptURL: `${SCOPE}sw.js` },
    getNotifications: async () => [{ close } as unknown as Notification],
    pushManager: { getSubscription: async () => ({ unsubscribe } as unknown as PushSubscription) },
    unregister,
  })])
  const { enablePush, quarantinePersonalPush, pushIsolationSnapshot, syncPush } = await import('./push')
  await quarantinePersonalPush()
  expect(close).toHaveBeenCalledOnce()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(unregister).toHaveBeenCalledOnce()
  expect(pushIsolationSnapshot()).toBe('retired')
  expect(await enablePush('it')).toBe(false)
  await syncPush('it')
})

it('fails closed for a legacy worker when cleanup APIs are absent, even if it unregisters', async () => {
  const unregister = vi.fn(async () => true)
  install([registration({ active: { scriptURL: `${SCOPE}old-worker.js` }, getNotifications: undefined, pushManager: undefined, unregister })])
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  await expect(quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
  expect(unregister).toHaveBeenCalledOnce()
  expect(pushIsolationSnapshot()).toBe('error')
})

it('fails closed when a supported notification query or subscription removal fails', async () => {
  const failingQuery = registration({ getNotifications: async () => { throw Error('synthetic query failure') } })
  install([failingQuery])
  const push1 = await import('./push')
  await expect(push1.quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
  expect(push1.pushIsolationSnapshot()).toBe('error')

  vi.resetModules()
  const failingUnsubscribe = registration({ pushManager: { getSubscription: async () => ({ unsubscribe: async () => false } as unknown as PushSubscription) } })
  install([failingUnsubscribe])
  const push2 = await import('./push')
  await expect(push2.quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
  expect(push2.pushIsolationSnapshot()).toBe('error')
})

it('fails closed when a legacy registration cannot be unregistered', async () => {
  install([registration({
    active: { scriptURL: `${SCOPE}old-worker.js` },
    unregister: async () => false,
  })])
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  await expect(quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
  expect(pushIsolationSnapshot()).toBe('error')
})

it('recovers from a transient cleanup error only after a successful retry', async () => {
  let failing = true
  install([registration({ getNotifications: async () => {
    if (failing) throw Error('synthetic temporary failure')
    return []
  } })])
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  await expect(quarantinePersonalPush()).rejects.toThrow('push isolation not verified')
  expect(pushIsolationSnapshot()).toBe('error')
  failing = false
  await quarantinePersonalPush()
  expect(pushIsolationSnapshot()).toBe('safe')
})

it('keeps a retired legacy worker gated until a fresh page realm confirms cleanup', async () => {
  let registrations = [registration({ active: { scriptURL: `${SCOPE}old-worker.js` } })]
  vi.stubGlobal('location', { origin: ORIGIN })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => registrations } })
  const oldPage = await import('./push')
  await oldPage.quarantinePersonalPush()
  expect(oldPage.pushIsolationSnapshot()).toBe('retired')
  registrations = []
  await oldPage.quarantinePersonalPush()
  expect(oldPage.pushIsolationSnapshot()).toBe('retired')
  vi.resetModules()
  const reopenedPage = await import('./push')
  await reopenedPage.quarantinePersonalPush()
  expect(reopenedPage.pushIsolationSnapshot()).toBe('safe')
})

it('coalesces simultaneous cleanup calls within one browser realm', async () => {
  let resolve!: (registrations: ServiceWorkerRegistration[]) => void
  const getRegistrations = vi.fn(() => new Promise<ServiceWorkerRegistration[]>(r => { resolve = r }))
  vi.stubGlobal('location', { origin: ORIGIN })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations } })
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  const first = quarantinePersonalPush(), second = quarantinePersonalPush()
  expect(second).toBe(first)
  resolve([registration()])
  await first
  expect(getRegistrations).toHaveBeenCalledOnce()
  expect(pushIsolationSnapshot()).toBe('safe')
})

it('does not inspect or retire registrations outside the exact application scope', async () => {
  const unregister = vi.fn(), getNotifications = vi.fn()
  install([registration({ scope: `${ORIGIN}/another-app/`, active: { scriptURL: `${ORIGIN}/another-app/sw.js` }, unregister, getNotifications })])
  const { quarantinePersonalPush, pushIsolationSnapshot } = await import('./push')
  await quarantinePersonalPush()
  expect(unregister).not.toHaveBeenCalled()
  expect(getNotifications).not.toHaveBeenCalled()
  expect(pushIsolationSnapshot()).toBe('safe')
})

it('keeps personal reminder snapshots account-scoped and excludes demo', async () => {
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
