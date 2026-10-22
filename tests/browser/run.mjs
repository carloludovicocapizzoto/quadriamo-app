import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=fileURLToPath(new URL('../../',import.meta.url))
const out=resolve(process.env.ACCOUNT_EVIDENCE||'')
if(!process.env.ACCOUNT_EVIDENCE||out===resolve(repo)||out.startsWith(resolve(repo)+sep))throw Error('ACCOUNT_EVIDENCE must be outside the repository')
await mkdir(out,{recursive:true})
Object.assign(process.env,{VITE_SUPABASE_URL:'http://127.0.0.1:59999',VITE_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key',VITE_SUPABASE_ANON_KEY:'',VITE_VAPID_PUBLIC_KEY:'',VITE_FLAGS:'',BASE_PATH:'/'})
const {createServer,build}=await import('vite')
const server=await createServer({configFile:resolve(repo,'tests/browser/vite.config.ts')})
await server.listen()
async function run(file,env){await new Promise((ok,bad)=>{const child=spawn(process.execPath,[resolve(repo,file)],{cwd:repo,windowsHide:true,stdio:'inherit',env:{...process.env,...env}});child.on('error',bad);child.on('exit',code=>code===0?ok():bad(Error(file+' exited '+code)))})}
try{
 for(const width of [1280,390])await run('tests/browser/accounts.mjs',{ACCOUNT_WIDTH:String(width),ACCOUNT_EVIDENCE:resolve(out,String(width))})
 const output=resolve(out,'pwa-build-'+Date.now())
 await build({configFile:resolve(repo,'vite.config.ts'),mode:'production',build:{outDir:output,emptyOutDir:false}})
 await run('tests/browser/pwa.mjs',{ACCOUNT_PWA_BUILD:output,ACCOUNT_EVIDENCE:resolve(out,'pwa')})
}finally{await server.close()}
