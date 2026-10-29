import { expect, it, vi } from 'vitest'

const boot = vi.hoisted(() => ({ stored: true }))
vi.mock('../env', () => ({ ENV: { name: 'alpha', supabase: { url: 'http://localhost:4192', key: 'synthetic' } } }))
vi.mock('../entry', () => ({ INVITE_LINK: false }))
vi.mock('./alphaFetch', () => ({ alphaFetch: vi.fn() }))
vi.mock('./offlineSession', () => ({ storedAuthSession: () => boot.stored ? { user: { id: 'synthetic-A' } } : null }))
vi.mock('./authStorage', () => ({ authStorageKey: () => 'test', authVersion: () => 'generation', authStorage: () => ({}),
  watchAuthStorage: vi.fn(), authCleanupFailed: () => false, authWriteFailed: () => false }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => {
  // Fast rejected renewal can erase persistence before React mounts SessionProvider.
  boot.stored = false
  return { auth: { dispose: async () => {} } }
} }))

it.each([true, false])('remembers whether bootstrap started with a retained session (%s), even if SDK clears it before React', async stored => {
  vi.resetModules(); boot.stored = stored
  const client = await import('./client')
  expect(boot.stored).toBe(false)
  expect(Reflect.get(client, 'AUTH_SESSION_AT_BOOT')).toBe(stored)
})
