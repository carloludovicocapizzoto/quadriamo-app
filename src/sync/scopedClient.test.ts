import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateScope } from '../store/scope'
import { scopedClient } from './scopedClient'

const auth = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('./client', () => ({ supabase: { auth } }))
vi.mock('../env', () => ({ ENV: { supabase: { url: 'http://127.0.0.1:54321', key: 'synthetic-public-key' } } }))
const scope = (owner: string) => ({ environment: 'test', backend: 'http://127.0.0.1:54321', kind: 'account' as const, owner })
const session = (owner: string) => ({ data: { session: { user: { id: owner }, access_token: 'synthetic-' + owner } }, error: null })
const transport = vi.fn(async (_url: unknown, _init: RequestInit | undefined) => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
beforeEach(() => { auth.getSession.mockReset(); transport.mockClear(); vi.stubGlobal('fetch', transport) })
afterEach(() => vi.unstubAllGlobals())

it('the actual Supabase SDK uses the captured owner token and abort signal', async () => {
  const lease = activateScope(scope('A'))
  auth.getSession.mockResolvedValue(session('A'))
  const result = await scopedClient(lease)!.from('user_data').select('data')
  expect(result.error).toBeNull()
  const init = transport.mock.calls[0][1]!
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer synthetic-A')
  expect(init.signal).toBe(lease.signal)
  activateScope(scope('B'))
  expect(init.signal!.aborted).toBe(true)
})
it('never sends an A operation with B credentials', async () => {
  const lease = activateScope(scope('A'))
  auth.getSession.mockResolvedValue(session('B'))
  const result = await scopedClient(lease)!.from('user_data').upsert({ user_id: 'A' })
  expect(result.error).toBeTruthy()
  expect(transport).not.toHaveBeenCalled()
})
it('keeps the RPC deadline as well as the session cancellation signal', async () => {
  const lease = activateScope(scope('A')), timeout = new AbortController()
  auth.getSession.mockResolvedValue(session('A'))
  await scopedClient(lease)!.rpc('qsync_read').abortSignal(timeout.signal)
  const sent = transport.mock.calls[0][1]!.signal!
  expect(sent.aborted).toBe(false); timeout.abort()
  expect(sent.aborted).toBe(true); expect(lease.signal.aborted).toBe(false)
})
it('rejects a token read completing after A→B→A, before any network request', async () => {
  const lease = activateScope(scope('A'))
  let finish!: (s: ReturnType<typeof session>) => void
  const token = new Promise(r => { finish = r })
  auth.getSession.mockImplementation(() => token)
  const pending = Promise.resolve(scopedClient(lease)!.from('user_data').select('data'))
  await vi.waitFor(() => expect(auth.getSession).toHaveBeenCalled())
  activateScope(scope('B')); activateScope(scope('A')); finish(session('A'))
  expect((await pending).error).toBeTruthy()
  expect(transport).not.toHaveBeenCalled()
})
it('demo, recovery and guest cannot obtain a personal data client', () => {
  for (const kind of ['demo', 'recovery', 'guest'] as const) {
    expect(scopedClient(activateScope({ ...scope('A'), kind }))).toBeNull()
  }
})
