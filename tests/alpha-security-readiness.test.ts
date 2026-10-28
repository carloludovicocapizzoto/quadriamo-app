import { createHmac } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/rest/[[path]].js'

const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222'
const env={ALPHA_SUPABASE_REST_URL:'https://alpha.synthetic.invalid/rest/v1',ALPHA_SUPABASE_PUBLISHABLE_KEY:'synthetic-public',ALPHA_GATEWAY_KEY_HEX:'ab'.repeat(32)}
const token=(claims: object)=>`e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.invalid-signature`
const req=(authorization?: string,body='{}',extra: Record<string,string>={})=>new Request('https://alpha.synthetic.invalid/api/rest/rpc/qsync_read',{
  method:'POST',body,headers:{'content-type':'application/json','cf-connecting-ip':'203.0.113.1',...(authorization?{authorization}:{}),...extra}})
afterEach(()=>vi.unstubAllGlobals())
it.each([undefined,'Basic synthetic','Bearer broken',`Bearer ${token({sub:A,role:'anon'})}`])('rejects malformed/missing authentication before upstream (%s)',async auth=>{
  const fetch=vi.fn(); vi.stubGlobal('fetch',fetch)
  expect((await onRequest({request:req(auth),env})).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})
it.each([401,403])('delegates signature/expiry validation to Supabase and fails closed on admission %s',async status=>{
  const fetch=vi.fn(async()=>new Response('{}',{status}));vi.stubGlobal('fetch',fetch)
  const auth=`Bearer ${token({sub:A,role:'authenticated',exp:1})}`
  expect((await onRequest({request:req(auth),env})).status).toBe(401)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(String(fetch.mock.calls[0][0])).toContain('/rpc/alpha_admit_request')
})
it('binds the HMAC to JWT subject, method, route and measured bytes; discards injected signature headers',async()=>{
  const calls: [string, RequestInit][]=[]
  vi.stubGlobal('fetch',vi.fn(async(url,options)=>{calls.push([String(url),options]);return new Response(JSON.stringify(String(url).endsWith('alpha_admit_request')?{allowed:true}:{protocol:2}),{status:200,headers:{'x-alpha-signature':'must-not-leak'}})}))
  const body=JSON.stringify({user_id:B})
  const response=await onRequest({request:req(`Bearer ${token({sub:A,role:'authenticated'})}`,body,{'x-alpha-ts':'1','x-alpha-signature':'attacker','x-alpha-bytes':'0'}),env})
  expect(response.status).toBe(200)
  const headers=calls[1][1].headers as Record<string,string>
  const canonical=`${headers['x-alpha-ts']}\nPOST\nrpc/qsync_read\n${A}\n${Buffer.byteLength(body)}`
  expect(headers['x-alpha-signature']).toBe(createHmac('sha256',Buffer.from(env.ALPHA_GATEWAY_KEY_HEX,'hex')).update(canonical).digest('hex'))
  expect(response.headers.get('x-alpha-signature')).toBeNull()
  expect(response.headers.get('cache-control')).toBe('no-store')
})
it.each(['rpc/delete_my_account','rpc/qsync_prune_expired','rpc/admin_users','user_data','rpc/alpha_admit_request'])('rejects route %s without upstream access',async path=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
  const request=new Request(`https://alpha.synthetic.invalid/api/rest/${path}`,{method:'POST',body:'{}'})
  expect((await onRequest({request,env})).status).toBe(404)
  expect(fetch).not.toHaveBeenCalled()
})
it('bounds a streamed body even without content-length, after charging admission',async()=>{
  const fetch=vi.fn(async()=>new Response('{"allowed":true}'));vi.stubGlobal('fetch',fetch)
  const request=new Request('https://alpha.synthetic.invalid/api/rest/rpc/qsync_write_v2',{method:'POST',
    headers:{authorization:`Bearer ${token({sub:A,role:'authenticated'})}`,'cf-connecting-ip':'203.0.113.1','content-type':'application/json'},
    body:new ReadableStream({start(c){c.enqueue(new Uint8Array(1024*1024));c.enqueue(new Uint8Array(1024*1024+1));c.close()}}),duplex:'half'} as RequestInit)
  expect((await onRequest({request,env})).status).toBe(413)
  expect(fetch).toHaveBeenCalledTimes(1)
})
