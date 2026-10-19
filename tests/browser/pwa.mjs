import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {resolve,extname,join,sep} from 'node:path'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const OUT=process.env.ACCOUNT_EVIDENCE, BUILD=process.env.ACCOUNT_PWA_BUILD
if(!OUT||!BUILD)throw Error('Set external ACCOUNT_EVIDENCE and ACCOUNT_PWA_BUILD')
await mkdir(OUT,{recursive:true})
const ORIGIN='http://127.0.0.1:5198', API='http://127.0.0.1:59999'
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const results=[],errors=[]
const legacyPush=execFileSync('git',['show','aabdc210:public/push-sw.js'],{encoding:'utf8'})
async function paths(dir,prefix=''){let all=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+'/'+e.name;all.push(...(e.isDirectory()?await paths(join(dir,e.name),p):[p]))}return all}
const assets=await paths(BUILD)
const observePush = `
const listen = self.addEventListener.bind(self);
self.addEventListener = (kind, handler, ...options) => kind !== 'push' ? listen(kind, handler, ...options) : listen(kind, event => {
  self.testPushStarted = true; self.testPushDone = false;
  handler({data: event.data, waitUntil: promise => event.waitUntil(Promise.resolve(promise).then(
    () => { self.testPushDone = true }, error => { self.testPushDone = true; self.testPushError = String(error); throw error }
  ))});
}, ...options);
`;
const oldScript=observePush+legacyPush+`\nself.addEventListener('install',e=>e.waitUntil(caches.open('legacy-test-app').then(c=>c.addAll(${JSON.stringify(assets.filter(p=>!p.endsWith('/sw.js')))})).then(()=>self.skipWaiting())));\nself.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));\nself.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('/app/index.html'):null)||fetch(e.request))));`
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,ORIGIN)
 if(url.pathname==='/test-blank'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<p>synthetic test holder</p>')}
 if(url.pathname==='/legacy-sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});return res.end(oldScript)}
 let rel=decodeURIComponent(url.pathname);if(rel.endsWith('/'))rel+='index.html'
 const file=resolve(BUILD,'.'+rel);if(!file.startsWith(resolve(BUILD)+sep))throw Error('path')
 const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)
}catch{res.writeHead(404);res.end()}})
await new Promise(ok=>server.listen(5198,'127.0.0.1',ok))
const browser=await chromium.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:JSON.parse(process.env.CHROME_ARGS||'[]')})
const factory=await browser.newContext();const probe=await factory.newPage();await probe.goto('http://127.0.0.1:5197/app/');await probe.waitForFunction(()=>!!window.accountTest)
const budget=await probe.evaluate(()=>window.accountTest.initial('B-only'));await factory.close();await browser.close()
const user={id:B,email:B+'@synthetic.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01',user_metadata:{first_name:'SyntheticB',last_name:'Test'},app_metadata:{},created_at:'2026-01-01'}
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:B,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',iss:API+'/auth/v1'})).toString('base64url'),'synthetic'].join('.')
const session={access_token:token,refresh_token:'synthetic-refresh-B',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}
const profile=resolve(OUT,'synthetic-profile-'+Date.now())
let context,page,offline=false
async function launch(){
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:JSON.parse(process.env.CHROME_ARGS||'[]'),viewport:{width:390,height:844},reducedMotion:'reduce'})
 await context.grantPermissions(['notifications'],{origin:ORIGIN})
 await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url())
   if(offline)return route.abort()
   if(u.origin===ORIGIN)return route.continue()
   if(u.origin!==API)return route.abort()
   if(u.pathname.endsWith('/qsync_read'))return route.fulfill({json:{protocol:1,mode:'protected',revision:'1',document:budget}})
   if(u.pathname.endsWith('/qsync_write'))return route.fulfill({json:{status:'applied',revision:'2',operation:req.postDataJSON().p_operation,replay:false}})
   if(u.pathname.endsWith('/user_data'))return route.fulfill({json:req.method()==='GET'?{data:budget}:null})
   if(u.pathname==='/auth/v1/user')return route.fulfill({json:user})
   if(u.pathname==='/auth/v1/token')return route.fulfill({json:session})
   if(u.pathname.includes('subscriptions')||u.pathname.includes('profiles'))return route.fulfill({json:null})
   if(u.pathname.includes('/storage/'))return route.fulfill({status:404,json:{message:'not found'}})
   return route.fulfill({json:[]})
 })
 page=context.pages()[0]||await context.newPage();page.on('pageerror',e=>errors.push(e.message))
}
async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+': '+e.message)}}
try{
 await launch()
 await context.addInitScript(session=>{if(!Object.keys(localStorage).some(key=>key.startsWith('q.auth.v1/'))&&!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('quadriamo.lang','it');localStorage.setItem('q.installSkip','1')},session)
 await page.goto(ORIGIN+'/app/');await page.locator('.tabbar').waitFor()
 await check('current production PWA installs and controls the app',async()=>{await page.getByText('B-only',{exact:true}).first().waitFor();await page.getByText(/Modifiche confermate alla revisione cloud/).waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.locator('.tabbar').waitFor();await page.getByText('B-only',{exact:true}).first().waitFor()})
 await check('real browser restart without network preserves the owned cache',async()=>{
   await context.close();offline=true;await launch();await context.setOffline(true);await page.goto(ORIGIN+'/app/');await page.locator('.tabbar').waitFor()
   await page.getByText('B-only',{exact:true}).first().waitFor();assert(!(await page.textContent('body')).includes('A-only'))
   await page.screenshot({path:OUT+'/offline-restart.png',fullPage:true})
 })
 offline=false;await context.setOffline(false)
 await page.evaluate(data=>new Promise(ok=>{const r=indexedDB.open('keyval-store');r.onsuccess=()=>{const tx=r.result.transaction('keyval','readwrite');const s=tx.objectStore('keyval');s.put(data,'quadriamo.data.v1');s.put({lang:'it',currency:'EUR',end:new Date(Date.now()+30*864e5).toISOString().slice(0,10),items:[{name:'LEGACY-A-SECRET',free:2345}]},'quadriamo.morning');tx.oncomplete=ok}}),{...budget,transactions:[{...budget.transactions[0],description:'LEGACY-A-SECRET'}]})
 await page.evaluate(()=>location.hash='#/profile/security');await page.getByText('Esci',{exact:true}).waitFor()
 await check('subscription retirement failure blocks account UI until explicit retry',async()=>{
   await page.evaluate(()=>{window.originalSubscription=PushManager.prototype.getSubscription;PushManager.prototype.getSubscription=async()=>({unsubscribe:async()=>false})})
   await page.getByText('Esci',{exact:true}).click()
   await page.getByRole('alert').filter({hasText:'vecchie notifiche'}).waitFor()
   assert.equal(await page.locator('.tabbar').count(),0)
   assert(!(await page.textContent('body')).includes('B-only'))
   await page.evaluate(()=>PushManager.prototype.getSubscription=window.originalSubscription)
   await page.getByRole('button',{name:'Riprova',exact:true}).click();await page.locator('.gate-cta').waitFor()
   await page.locator('.gate-cta').click();await page.locator('input[type=email]').fill(user.email)
   await page.locator('.auth-form button[type=submit], .auth-form .step-nav .btn.primary').click()
   await page.locator('input[type=password]').fill('Synthetic-test-only-42');await page.locator('.auth-form .step-nav .btn.primary').click()
   await page.locator('.tabbar').waitFor()
   await page.evaluate(()=>location.hash='#/profile/security');await page.getByText('Esci',{exact:true}).waitFor()
 })
 await page.close();page=await context.newPage();await page.goto(ORIGIN+'/test-blank');page.on('pageerror',e=>errors.push(e.message))
 const cdp=await context.newCDPSession(page);let registrations=[], oldId
 cdp.on('ServiceWorker.workerRegistrationUpdated',e=>{for(const r of e.registrations){registrations=registrations.filter(x=>x.registrationId!==r.registrationId);registrations.push(r)}})
 await cdp.send('ServiceWorker.enable')
 await check('install the actual legacy push worker over the current app',async()=>{
   await page.evaluate(async()=>{await navigator.serviceWorker.register('/legacy-sw.js',{scope:'/'})})
   await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/legacy-sw.js'))
   oldId=registrations.find(x=>x.scopeURL===ORIGIN+'/'&&!x.isDeleted)?.registrationId
   assert(oldId,'legacy registration observed by Chromium')
 })
 const old=context.serviceWorkers().find(w=>w.url().endsWith('/legacy-sw.js'))
 await check('queued legacy push cannot expose A during the blocked migration',async()=>{
   const holder=await context.newPage();await holder.goto(ORIGIN+'/test-blank')
   await holder.evaluate(()=>new Promise(ok=>{const r=indexedDB.open('keyval-store');r.onsuccess=()=>{const tx=r.result.transaction('keyval','readwrite'),s=tx.objectStore('keyval');let release=false;window.releaseDB=()=>release=true;const next=()=>{const q=s.get('hold');q.onsuccess=()=>{if(!release)next()}};next();ok()}}))
   const queued=cdp.send('ServiceWorker.deliverPushMessage',{origin:ORIGIN,registrationId:oldId,data:JSON.stringify({kind:'morning',lang:'it'})}).catch(e=>e.message)
   for(let i=0;i<100&&!await old.evaluate(()=>!!self.testPushStarted);i++)await new Promise(r=>setTimeout(r,10))
   assert(await old.evaluate(()=>!!self.testPushStarted),'the legacy push must already be running before retirement')
   offline=true;await context.setOffline(true)
   await page.goto(ORIGIN+'/app/').catch(e=>{if(!e.message.includes('ERR_ABORTED'))throw e})
   await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistrations()).some(r=>r.active?.scriptURL.endsWith('/legacy-sw.js')))
   await holder.evaluate(()=>window.releaseDB());await queued;await holder.close()
   for(let i=0;i<100&&!await old.evaluate(()=>!!self.testPushDone);i++)await new Promise(r=>setTimeout(r,10))
   assert(await old.evaluate(()=>!!self.testPushDone),'inspect notifications only after the actual legacy handler completed')
   const visible=await old.evaluate(async()=> (await self.registration.getNotifications()).map(n=>({title:n.title,body:n.body}))).catch(()=>[])
   await page.getByRole('alert').filter({hasText:'chiudi completamente'}).waitFor()
   assert.equal(await page.locator('.tabbar').count(),0)
   assert(!visible.some(n=>n.body.includes('LEGACY-A-SECRET')),'queued legacy notification exposed: '+JSON.stringify(visible))
 })
 await check('late unbound push cannot target the retired registration',async()=>{
   await old.evaluate(async()=>{for(const n of await self.registration.getNotifications())n.close()}).catch(()=>{})
   await old.evaluate(()=>{self.testPushStarted=false;self.testPushDone=false}).catch(()=>{})
   await cdp.send('ServiceWorker.deliverPushMessage',{origin:ORIGIN,registrationId:oldId,data:JSON.stringify({kind:'morning',lang:'it'})}).catch(()=>{})
   for(let i=0;i<50;i++){const status=await old.evaluate(()=>({started:self.testPushStarted,done:self.testPushDone})).catch(()=>({started:false,done:true}));if(status.started&&status.done)break;await new Promise(r=>setTimeout(r,10))}
   const registered=await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).map(r=>r.active?.scriptURL))
   assert(!registered.some(url=>url?.endsWith('/legacy-sw.js')))
   const visible=await old.evaluate(async()=> (await self.registration.getNotifications()).map(n=>n.body)).catch(()=>[])
   assert(!visible.some(body=>body.includes('LEGACY-A-SECRET')))
   assert(!(await page.textContent('body')).includes('LEGACY-A-SECRET'))
 })
 await check('return online restores the safe worker and offline startup',async()=>{
   await context.close();offline=false;await launch();await page.goto(ORIGIN+'/app/');await page.locator('.tabbar').waitFor()
   await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/sw-account-v2.js'))
   await page.evaluate(()=>navigator.serviceWorker.ready)
   await context.close();offline=true;await launch();await context.setOffline(true);await page.goto(ORIGIN+'/app/')
   await page.locator('.tabbar').waitFor();await page.getByText('B-only',{exact:true}).first().waitFor()

 })
}finally{
 await writeFile(OUT+'/pwa.json',JSON.stringify({results,errors,browser:'Chromium via local Chrome',profile},null,2));console.log(JSON.stringify({results,errors},null,2));await context?.close();await new Promise(ok=>server.close(ok));if(results.some(r=>!r.pass))process.exitCode=1
}
