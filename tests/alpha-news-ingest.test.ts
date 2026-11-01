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
