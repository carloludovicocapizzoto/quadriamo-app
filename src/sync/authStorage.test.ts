import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authStorage } from './authStorage'
import { activateScope } from '../store/scope'

const memory = new Map<string, string>()
const data = (id: string, token = id) => JSON.stringify({ user: { id }, access_token: token })
const scope = (owner: string) => ({ environment: 'test', backend: 'synthetic', kind: 'account' as const, owner })
beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) })
  vi.stubGlobal('navigator', { locks: { request: async (_key: string, run: () => void) => run() } })
})
afterEach(() => vi.unstubAllGlobals())
it('rejects a command whose stored auth owner already differs from the UI owner', () => {
  memory.set('auth', data('B'))
  expect(() => authStorage('auth', activateScope(scope('A')))).toThrow('auth owner mismatch')
})
it('neither saves nor removes a session changed while an operation was pending', async () => {
  memory.set('auth', data('A'))
  const storage = authStorage('auth', activateScope(scope('A')))
  memory.set('auth', data('B'))
  await expect(storage.setItem('auth', data('A'))).rejects.toThrow('auth session changed')
  await expect(storage.removeItem('auth')).rejects.toThrow('auth session changed')
  expect(memory.get('auth')).toBe(data('B'))
})
it('rejects an old A operation after an unobserved A→B→A with a new token', async () => {
  memory.set('auth', data('A', 'old'))
  const storage = authStorage('auth', activateScope(scope('A')))
  memory.set('auth', data('A', 'new'))
  await expect(storage.removeItem('auth')).rejects.toThrow()
  expect(memory.get('auth')).toBe(data('A', 'new'))
})
it('checks the lease inside the storage lock, not before waiting for it', async () => {
  memory.set('auth', data('A'))
  let commit!: () => void
  vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => void) => new Promise<void>((ok, bad) => {
    commit = () => { try { run(); ok() } catch (e) { bad(e) } }
  }) } })
  const storage = authStorage('auth', activateScope(scope('A')))
  const pending = storage.removeItem('auth')
  activateScope(scope('B')); memory.set('auth', data('B')); commit()
  await expect(pending).rejects.toThrow('session changed')
  expect(memory.get('auth')).toBe(data('B'))
})
it('permits an explicit sign-in and its own subsequent cleanup, without deleting another session', async () => {
  const guest = activateScope({ ...scope('A'), kind: 'guest', owner: null })
  const storage = authStorage('auth', guest, true)
  await storage.setItem('auth', data('A'))
  await storage.removeItem('auth')
  expect(memory.has('auth')).toBe(false)
})
it('fails visibly without a cross-tab write lock', async () => {
  memory.set('auth', data('A')); vi.stubGlobal('navigator', {})
  const storage = authStorage('auth', activateScope(scope('A')))
  await expect(storage.removeItem('auth')).rejects.toThrow('Web Locks')
  expect(memory.has('auth')).toBe(true)
})
