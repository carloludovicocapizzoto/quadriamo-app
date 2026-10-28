import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { beforeAll, afterAll, expect, it } from 'vitest'

// Exact versioned migration function, with minimal SQL identity fixtures. This is NOT a JWT verifier or PostgREST stack.
const sql=readFileSync('supabase/alpha-clean-start/supabase/migrations/20261020000500_alpha_data_api_gate.sql','utf8')
const gate=sql.slice(sql.indexOf('create function alpha_http.check_request()'),sql.indexOf('revoke all on function alpha_http.check_request()'))
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',secret='ab'.repeat(32)
let db: PGlite
beforeAll(async()=>{
  db=new PGlite({extensions:{pgcrypto}})
  await db.exec(`create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth; create function auth.uid() returns uuid language sql as $$ select current_setting('test.uid')::uuid $$;
    create function auth.role() returns text language sql as $$ select current_setting('test.role') $$;
    create schema alpha_http; create table alpha_http.gateway_key(id boolean, secret bytea);
    insert into alpha_http.gateway_key values(true,decode('${secret}','hex'));
    create table alpha_http.policy(id boolean,max_body_bytes integer); insert into alpha_http.policy values(true,2097152);`)
  await db.exec(gate)
},20000)
afterAll(async()=>{await db?.close()})
const headers=(owner=A,path='rpc/qsync_read',bytes='2',ts=String(Math.floor(Date.now()/1000)))=>({
  'x-alpha-ts':ts,'x-alpha-bytes':bytes,'x-alpha-signature':createHmac('sha256',Buffer.from(secret,'hex')).update(`${ts}\nPOST\n${path}\n${owner}\n${bytes}`).digest('hex')})
async function check(h: object,owner=A,path='rpc/qsync_read',role='authenticated') {
  await db.exec('begin')
  try {
    for(const [k,v] of Object.entries({'test.uid':owner,'test.role':role,'request.method':'POST','request.path':path,'request.headers':JSON.stringify(h)}))
      await db.query('select set_config($1,$2,true)',[k,v])
    await db.query('select alpha_http.check_request()')
  } finally {await db.exec('rollback')}
}
it('accepts an authentic owner-bound signature',async()=>{await expect(check(headers())).resolves.toBeUndefined()})
it('rejects anonymous role even with a synthetic valid signature',async()=>{await expect(check(headers(),A,'rpc/qsync_read','anon')).rejects.toMatchObject({code:'42501'})})
it('rejects missing signature',async()=>{await expect(check({})).rejects.toMatchObject({code:'42501'})})
it('rejects changing authenticated owner without recomputing signature',async()=>{await expect(check(headers(),B)).rejects.toMatchObject({code:'42501'})})
it('rejects nonallowlisted RPC even when correctly signed',async()=>{await expect(check(headers(A,'rpc/admin_users'),A,'rpc/admin_users')).rejects.toMatchObject({code:'42501'})})
it.each([-120,120])('rejects signed timestamp offset %s seconds',async offset=>{await expect(check(headers(A,'rpc/qsync_read','2',String(Math.floor(Date.now()/1000)+offset)))).rejects.toMatchObject({code:'42501'})})
it('rejects a correctly signed excessive length',async()=>{await expect(check(headers(A,'rpc/qsync_read','2097153'))).rejects.toMatchObject({code:'PT413'})})
it('documents bounded replay: same signed envelope remains valid inside the clock window',async()=>{
  const h=headers();await check(h);await expect(check(h)).resolves.toBeUndefined()
  // Canonical envelope binds neither query string nor body digest. No browser exposure of this header was found.
})
