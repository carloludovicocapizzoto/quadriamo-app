import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authStorage } from './authStorage'
import { cachedOfflineSession, storedAuthSession } from './offlineSession'
const key = 'synthetic-auth', namespace = 'offline-session-test', memory = new Map<string, string>()
const jwt = (sub: string, role = 'authenticated') => [btoa('{"alg":"HS256"}'), btoa(JSON.stringify({ sub, role, exp: 1 })), 'synthetic'].join('.')
const a = { user: { id: 'A' }, access_token: jwt('A'), refresh_token: 'synthetic', expires_at: 1, token_type: 'bearer' }
beforeEach(() => {
  memory.clear()
  vi.stubGlobal('navigator', { onLine: false, locks: { request: async (_key: string, run: () => void) => run() } })
  vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) })
})
afterEach(() => vi.unstubAllGlobals())
it('opens only the retained backend identity offline despite token expiry, without renewing credentials', () => {
  memory.set(key, JSON.stringify(a)); expect(cachedOfflineSession(key, namespace)).toEqual(a)
})
it('does not substitute a cached identity while online', () => {
  memory.set(key, JSON.stringify(a)); vi.stubGlobal('navigator', { onLine: true })
  expect(cachedOfflineSession(key, namespace)).toBeNull()
})
it('can retain the identified owner after a retryable network failure even if the browser reports online', () => {
  memory.set(key, JSON.stringify(a)); vi.stubGlobal('navigator', { onLine: true })
  expect(cachedOfflineSession(key, namespace, undefined, true)).toEqual(a)
})
it('rejects a retained identity from another backend issuer', () => {
  memory.set(key, JSON.stringify(a))
  expect(cachedOfflineSession(key, namespace, 'http://another-backend.invalid')).toBeNull()
})
it.each([{}, { ...a, user: { id: 'B' } }, { ...a, access_token: jwt('A', 'anon') }, { ...a, refresh_token: '' }, { ...a, access_token: 'broken' }])('rejects malformed or mismatched retained sessions', value => {
  memory.set(key, JSON.stringify(value)); expect(cachedOfflineSession(key, namespace)).toBeNull()
  expect(() => storedAuthSession(key, namespace)).toThrow()
})
it('never reopens credentials rewritten to the legacy key after logout', async () => {
  memory.set(key, JSON.stringify(a)); await authStorage(key, undefined, false, namespace).removeItem(key)
  memory.set(key, JSON.stringify(a)); expect(cachedOfflineSession(key, namespace)).toBeNull()
})
it('does not guess another cached account or ignore inaccessible storage', () => {
  expect(cachedOfflineSession(key, namespace)).toBeNull()
  vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied') } })
  expect(cachedOfflineSession(key, namespace)).toBeNull()
})
