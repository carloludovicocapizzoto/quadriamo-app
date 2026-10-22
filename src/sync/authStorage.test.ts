import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authStorage, authRecordKey, authCleanupFailed, retryAuthCleanup } from './authStorage'
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
it('discards a late write from the main SDK after local logout, even without an operation lease', async () => {
  memory.set('auth', data('A'))
  const sdk = authStorage('auth'); sdk.getItem('auth')
  await authStorage('auth', activateScope(scope('A'))).removeItem('auth')
  await sdk.setItem('auth', data('A', 'late-refresh'))
  expect(sdk.getItem('auth')).toBeNull(); expect(authStorage('auth').getItem('auth')).toBeNull()
})
it('does not let two SDK instances overwrite a newer token rotation', async () => {
  memory.set('auth', data('A'))
  const first = authStorage('auth'), second = authStorage('auth')
  await first.setItem('auth', data('A', 'first-rotation'))
  await second.setItem('auth', data('A', 'stale-rotation'))
  expect(authStorage('auth').getItem('auth')).toBe(data('A', 'first-rotation'))
})
it('fails closed on an unsupported auth record instead of adopting the old credential', () => {
  memory.set('auth', data('A'))
  memory.set('q.auth.v1/'+encodeURIComponent('auth'), JSON.stringify({format:99, generation:'future', session:null}))
  expect(() => authStorage('auth').getItem('auth')).toThrow()
})
it('keeps the logout tombstone authoritative after a legacy client rewrites its old key', async () => {
  memory.set('auth', data('A'))
  await authStorage('auth', activateScope(scope('A'))).removeItem('auth')
  memory.set('auth', data('A', 'legacy-resurrection'))
  expect(authStorage('auth').getItem('auth')).toBeNull()
})
it('does not partially replace the credential when its atomic commit fails', async () => {
  memory.set('auth', data('A'))
  const storage = authStorage('auth')
  vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null,
    setItem: () => { throw new DOMException('quota', 'QuotaExceededError') }, removeItem: (k: string) => memory.delete(k) })
  await expect(storage.setItem('auth', data('A', 'new'))).rejects.toThrow('quota')
  expect(memory.has(authRecordKey('auth'))).toBe(false)
  expect(storage.getItem('auth')).toBe(data('A'))
})
it('reports incomplete legacy cleanup but never reopens the committed logout; cleanup can be retried', async () => {
  memory.set('auth', data('A'))
  vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v), removeItem: () => { throw Error('cleanup denied') } })
  await expect(authStorage('auth').removeItem('auth')).rejects.toThrow('cleanup denied')
  expect(authStorage('auth').getItem('auth')).toBeNull()
  expect(authCleanupFailed('auth')).toBe(true)
  vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) })
  await retryAuthCleanup('auth', 'auth')
  expect(authCleanupFailed('auth')).toBe(false); expect(memory.has('auth')).toBe(false)
})
it('isolates auth records by environment and backend without changing the older key name', async () => {
  await authStorage('auth', undefined, false, 'development/backend-A').setItem('auth', data('A'))
  await authStorage('auth', undefined, false, 'production/backend-B').setItem('auth', data('B'))
  expect(authStorage('auth', undefined, false, 'development/backend-A').getItem('auth')).toBe(data('A'))
  expect(authStorage('auth', undefined, false, 'production/backend-B').getItem('auth')).toBe(data('B'))
})
it('allows only SDK auxiliary cleanup after its own session commit revokes the UI lease', async () => {
  memory.set('auth', data('A')); memory.set('auth-code-verifier', 'synthetic-verifier')
  const storage = authStorage('auth', activateScope(scope('A')))
  await storage.removeItem('auth'); activateScope({ ...scope('A'), kind: 'guest', owner: null })
  expect(storage.getItem('auth-code-verifier')).toBe('synthetic-verifier')
  expect(storage.getItem('auth-flows-code-verifier')).toBeNull()
  await storage.removeItem('auth-flows-code-verifier')
  await storage.removeItem('auth-code-verifier')
  await expect(storage.setItem('auth', data('A'))).rejects.toThrow()
  await authStorage('auth').setItem('auth', data('B'))
  await expect(storage.removeItem('auth-user')).rejects.toThrow()
})
it('reports an SDK persistence failure without accepting its new credential', async () => {
  memory.set('auth', data('A'))
  const storage = authStorage('auth', undefined, false, 'auth', undefined, true)
  vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null,
    setItem: () => { throw Error('SDK storage denied') }, removeItem: (k: string) => memory.delete(k) })
  await storage.setItem('auth', data('A', 'not-persisted'))
  expect(storage.failure()).toBeInstanceOf(Error)
  expect(memory.get('auth')).toBe(data('A'))
  await retryAuthCleanup('auth', 'auth')
})
