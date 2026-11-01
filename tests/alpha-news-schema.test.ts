import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { beforeAll, afterAll, expect, it } from 'vitest'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite({extensions:{pgcrypto}})
 await db.exec(readFileSync('tests/db/supabase.sql','utf8'))
 await db.exec('alter role service_role bypassrls; grant usage on schema public,auth to authenticated,anon,service_role')
 await db.exec(readFileSync('supabase/alpha-news/001_schema.sql','utf8'))
 const base=readFileSync('supabase/alpha-clean-start/supabase/migrations/20261020000500_alpha_data_api_gate.sql','utf8')
 await db.exec(base.slice(base.indexOf('create schema alpha_http;'),base.indexOf('-- PostgREST calls')))
 await db.exec("create function alpha_http.check_request() returns void language sql as 'select'; create function public.alpha_admit_request(text,text) returns jsonb language sql as $$select '{}'::jsonb$$;")
 await db.exec(readFileSync('supabase/alpha-news/002_gateway.sql','utf8'))
 await db.exec("insert into public.news_sources(id,name,kind,feed,lang,trust,active,rights_reference,approved_by) values ('a','Synthetic','press','https://synthetic.invalid','en',3,true,'synthetic-rights','synthetic-editor'),('b','Hidden','press','https://synthetic.invalid','en',3,false,null,null); insert into public.news_items(id,source_id,title,link,published,lang,format) values ('a','a','Synthetic','https://synthetic.invalid',now(),'en','article'),('b','b','Hidden','https://synthetic.invalid',now(),'en','article');")
},30000)
afterAll(async()=>db?.close())
async function as(role:string,sql:string){await db.exec('set role '+role);try{return await db.query(sql)}finally{await db.exec('reset role')}}
it('authenticated can read only active sources; anon and end-user writes are denied',async()=>{
 expect((await as('authenticated','select id from public.news_items')).rows).toEqual([{id:'a'}])
 await expect(as('anon','select id from public.news_items')).rejects.toThrow()
 await expect(as('authenticated',"delete from public.news_items")).rejects.toThrow()
 expect((await as('service_role','select id from public.news_items')).rows).toHaveLength(2)
})
it('the optional gateway keeps signed user reads and restricts the private ingest exception',async()=>{
 await db.exec("set test.role='authenticated';set test.uid='11111111-1111-4111-8111-111111111111';set request.method='GET';set request.path='/news_items'")
 await expect(db.exec('select alpha_http.check_request()')).rejects.toThrow('ALPHA_GATEWAY_UNCONFIGURED')
 await db.exec("insert into alpha_http.gateway_key(id,secret) values(true,decode(repeat('1',64),'hex'))")
 await expect(db.exec('select alpha_http.check_request()')).rejects.toThrow('ALPHA_GATEWAY_SIGNATURE_REQUIRED')
 const ts=String(Math.floor(Date.now()/1000)),sign=createHmac('sha256',Buffer.from('1'.repeat(64),'hex')).update(ts+'\nGET\nnews_items\n11111111-1111-4111-8111-111111111111\n0').digest('hex')
 await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-alpha-ts':ts,'x-alpha-bytes':'0','x-alpha-signature':sign})])
 await expect(db.exec('select alpha_http.check_request()')).resolves.toBeDefined()
 await db.exec("set test.role='service_role';set request.method='POST';set request.path='/news_items'")
 await expect(db.exec('select alpha_http.check_request()')).resolves.toBeDefined()
 await db.exec("set request.path='/profiles'")
 await expect(db.exec('select alpha_http.check_request()')).rejects.toThrow('ALPHA_AUTH_REQUIRED')
})

it('activating a source without approval provenance is rejected by the database',async()=>{await expect(db.exec("update public.news_sources set active=true where id='b'")).rejects.toThrow()})
