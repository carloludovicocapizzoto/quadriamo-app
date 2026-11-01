import { afterEach, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/rest/[[path]].js'

const user = '11111111-1111-4111-8111-111111111111'
const jwt = `e30.${Buffer.from(JSON.stringify({ sub: user, role: 'authenticated' })).toString('base64url')}.synthetic`
const env = { ALPHA_SUPABASE_REST_URL: 'https://new-alpha.invalid/rest/v1',
  ALPHA_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key', ALPHA_GATEWAY_KEY_HEX: '1'.repeat(64) }
const request = (path, body = '{}') => new Request(`https://alpha.invalid/api/rest/${path}`, {
  method: 'POST', headers: { authorization: `Bearer ${jwt}`, 'cf-connecting-ip': '203.0.113.1', 'content-type': 'application/json' }, body,
})
afterEach(() => vi.unstubAllGlobals())

it('denies non-allowlisted routes before accessing the Data API', async () => {
  const remote = vi.fn(); vi.stubGlobal('fetch', remote)
  const reply = await onRequest({ request: request('user_data?select=*'), env })
  expect(reply.status).toBe(404)
  expect(remote).not.toHaveBeenCalled()
})

it('charges admission before rejecting malformed and oversized bodies', async () => {
  const remote = vi.fn(async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }))
  vi.stubGlobal('fetch', remote)
  const malformed = await onRequest({ request: request('rpc/qsync_write_v2', '{bad-json'), env })
  expect(malformed.status).toBe(400)
  const large = await onRequest({ request: request('rpc/qsync_write_v2', JSON.stringify({ payload: 'x'.repeat(2 * 1024 * 1024) })), env })
  expect(large.status).toBe(413)
  expect(remote).toHaveBeenCalledTimes(2)
  expect(remote.mock.calls.every(([url]) => String(url).endsWith('/rpc/alpha_admit_request'))).toBe(true)
})

it('surfaces a committed rate limit with a retry interval', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ allowed: false, retry_after_seconds: 23 }), { status: 200 })))
  const reply = await onRequest({ request: request('rpc/qsync_read'), env })
  expect(reply.status).toBe(429)
  expect(reply.headers.get('retry-after')).toBe('23')
  expect(await reply.json()).toMatchObject({ code: 'PT429', details: { retry_after_seconds: 23 } })
})

it('forwards only a signed allowlisted request after admission', async () => {
  const remote = vi.fn(async url => String(url).endsWith('/rpc/alpha_admit_request')
    ? new Response(JSON.stringify({ allowed: true }), { status: 200 })
    : new Response(JSON.stringify({ protocol: 2, revision: '0' }), { status: 200 }))
  vi.stubGlobal('fetch', remote)
  const reply = await onRequest({ request: request('rpc/qsync_read'), env })
  expect(reply.status).toBe(200)
  expect(remote).toHaveBeenCalledTimes(2)
  const [url, options] = remote.mock.calls[1]
  expect(url).toBe('https://new-alpha.invalid/rest/v1/rpc/qsync_read')
  expect(options.headers['x-alpha-signature']).toMatch(/^[0-9a-f]{64}$/)
})

it('news stays disabled by default; enabled news is authenticated read-only through admission', async()=>{
 const remote=vi.fn(async url=>new Response(JSON.stringify(String(url).endsWith('rpc/alpha_admit_request')?{allowed:true}:[])))
 vi.stubGlobal('fetch',remote)
 const get=new Request('https://alpha.invalid/api/rest/news_items?select=id',{headers:{authorization:'Bearer '+jwt,'cf-connecting-ip':'203.0.113.1'}})
 expect((await onRequest({request:get,env})).status).toBe(404)
 expect((await onRequest({request:new Request(get),env:{...env,ALPHA_NEWS_ENABLED:'1'}})).status).toBe(200)
 expect(remote).toHaveBeenCalledTimes(2)
 expect((await onRequest({request:request('news_items'),env:{...env,ALPHA_NEWS_ENABLED:'1'}})).status).toBe(404)
 expect((await onRequest({request:new Request(get.url),env:{...env,ALPHA_NEWS_ENABLED:'1'}})).status).toBe(401)
})

it('an older client cannot read or write planning documents it would misinterpret',async()=>{
 const document={settings:{planVersion:1}},remote=vi.fn(async url=>new Response(JSON.stringify(String(url).endsWith('rpc/alpha_admit_request')?{allowed:true}:{document})))
 vi.stubGlobal('fetch',remote)
 expect((await onRequest({request:request('rpc/qsync_read'),env})).status).toBe(426)
 const modern=request('rpc/qsync_read');modern.headers.set('x-quadriamo-capabilities','monthly-plan-v1');expect((await onRequest({request:modern,env})).status).toBe(200)
 remote.mockClear();expect((await onRequest({request:request('rpc/qsync_write_v2',JSON.stringify({p_document_json:JSON.stringify(document)})),env})).status).toBe(426);expect(remote).toHaveBeenCalledTimes(1)
})
