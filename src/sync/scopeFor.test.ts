import { beforeEach, expect, it, vi } from 'vitest'
import { scopeFor } from './scopeFor'
const config = vi.hoisted(() => ({ name: 'test', base: '/', supabase: { url: 'http://backend.invalid/', key: 'synthetic' } as { url: string; key: string } | null }))
vi.mock('../env', () => ({ ENV: config }))
vi.mock('./client', () => ({ supabase: null }))
beforeEach(() => { config.supabase = { url: 'http://backend.invalid/', key: 'synthetic' } })
it('keeps a configured backend in guest scope when its auth runtime is unavailable', () => {
  expect(scopeFor(null)).toMatchObject({ kind: 'guest', owner: null, backend: 'http://backend.invalid' })
  expect(scopeFor('A')).toMatchObject({ kind: 'account', owner: 'A' })
})
it('uses local mode only when the backend is actually disabled', () => {
  config.supabase = null; vi.stubGlobal('window', { location: { origin: 'http://app.invalid' } })
  try { expect(scopeFor(null)).toMatchObject({ kind: 'local', owner: null }); expect(scopeFor(null, 'demo').kind).toBe('demo') }
  finally { vi.unstubAllGlobals() }
})
