import * as feed from '../supabase/functions/_shared/news-feed'
import * as rules from '../supabase/functions/_shared/news-rules'
import * as items from '../supabase/functions/_shared/news-item'
import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
it('the optional ingest fails closed before database/network work when disabled or unauthorized',async()=>{
 const client=vi.fn(),fetch=vi.fn();let handler!: (r:Request)=>Promise<Response>
 const source=readFileSync('supabase/functions/alpha-news-ingest/index.ts','utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const env:Record<string,string>={}
 runInNewContext(js,{exports:{},require:(name:string)=>name.startsWith('npm:')?{createClient:client}:{},Deno:{env:{get:(k:string)=>env[k]},serve:(f:typeof handler)=>{handler=f}},fetch,Response,URL,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto})
 expect((await handler(new Request('https://synthetic.invalid',{method:'POST'}))).status).toBe(503)
 env.ALPHA_NEWS_INGEST_ENABLED='1';env.CRON_SECRET='synthetic'
 expect((await handler(new Request('https://synthetic.invalid',{method:'POST'}))).status).toBe(403)
 expect(client).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
})

it('SIMULATED approved feed is deduplicated and metadata-only; unapproved hosts never fetched',async()=>{
 const env:Record<string,string>={ALPHA_NEWS_INGEST_ENABLED:'1',CRON_SECRET:'synthetic',SUPABASE_URL:'https://djkoxecmobafenfazcum.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key',NEWS_ALLOWED_HOSTS:'feed.invalid'}
 const src={id:'a',name:'Synthetic',kind:'institution',format:'rss',feed:'https://feed.invalid/rss',lang:'en',trust:4,topics:['economy'],images:false}
 const saved:unknown[][]=[];let updates=0;let handler!: (r:Request)=>Promise<Response>
 const from=(table:string)=>{let op='select';const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,gte:()=>q,lt:()=>q,delete:()=>{op='delete';return q},update:()=>{op='update';updates++;return q},upsert:(x:unknown[])=>{op='upsert';saved.push(x);return q},then:(ok:(x:unknown)=>unknown)=>Promise.resolve(ok({data:op==='select'?(table==='news_sources'?[src]:[]):null,error:null}))};return q}
 const xml='<rss><channel><item><title>Inflation and interest rates for households</title><link>https://source.invalid/article</link><description>Not republished</description></item><item><title>Duplicate headline</title><link>https://source.invalid/article</link></item></channel></rss>'
 const remote=vi.fn(async()=>new Response(xml))
 const js=ts.transpileModule(readFileSync('supabase/functions/alpha-news-ingest/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 runInNewContext(js,{exports:{},require:(n:string)=>n.startsWith('npm:')?{createClient:()=>({from})}:n.includes('news-feed')?feed:n.includes('news-rules')?rules:items,Deno:{env:{get:(k:string)=>env[k]},serve:(f:typeof handler)=>{handler=f}},fetch:remote,Response,URL,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto})
 const request=()=>new Request('https://local.invalid',{method:'POST',headers:{'x-cron-secret':'synthetic'}})
 expect((await handler(request())).status).toBe(200);expect(saved.flat()).toHaveLength(1);expect(saved.flat()[0]).toMatchObject({excerpt:null,thumb:null});expect(updates).toBe(1)
 expect(remote.mock.calls[0]?.length).toBe(2)
 env.NEWS_ALLOWED_HOSTS='other.invalid';remote.mockClear();saved.length=0
 const denied=await handler(request());expect((await denied.json()).failed).toHaveLength(1);expect(remote).not.toHaveBeenCalled()
})
