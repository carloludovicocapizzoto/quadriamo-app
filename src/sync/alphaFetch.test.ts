import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { alphaFetch } from './alphaFetch'

vi.mock('../env', () => ({ ENV: { name: 'alpha', base: '/', supabase: { url: 'https://alpha-ref.supabase.co', key: 'sb_publishable_test' } } }))
const sent = vi.fn()
beforeEach(() => {
  vi.stubGlobal('location', { origin: 'https://quadriamo-alpha.example' })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => { sent(input, init); return new Response('{}') })
})
afterEach(() => { vi.unstubAllGlobals(); sent.mockReset() })

it('routes the Data API to the gateway with the body already read, never as a stream (Safari, Firefox, HTTP/1.1)', async () => {
  const signal = new AbortController().signal
  await alphaFetch('https://alpha-ref.supabase.co/rest/v1/rpc/qsync_write_v2', { method: 'POST', body: '{"p_operation":"x"}',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, signal })
  const [url, init] = sent.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('https://quadriamo-alpha.example/api/rest/rpc/qsync_write_v2')
  expect(init.body).toBeInstanceOf(ArrayBuffer)
  expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"p_operation":"x"}')
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer token')
  expect(init.method).toBe('POST'); expect(init.signal?.aborted).toBe(false)
})
it('keeps GET without a body and leaves Auth and Storage on the Supabase project', async () => {
  await alphaFetch('https://alpha-ref.supabase.co/rest/v1/profiles?select=first_name')
  expect(sent.mock.calls[0][0]).toBe('https://quadriamo-alpha.example/api/rest/profiles?select=first_name')
  expect((sent.mock.calls[0][1] as RequestInit).body).toBeUndefined()
  await alphaFetch('https://alpha-ref.supabase.co/auth/v1/token?grant_type=password', { method: 'POST', body: '{}' })
  expect((sent.mock.calls[1][0] as Request).url).toBe('https://alpha-ref.supabase.co/auth/v1/token?grant_type=password')
})
it('an abort of the caller still aborts the forwarded request', async () => {
  const controller = new AbortController()
  await alphaFetch('https://alpha-ref.supabase.co/rest/v1/rpc/qsync_read', { method: 'POST', body: '{}', signal: controller.signal })
  controller.abort()
  expect((sent.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
})
