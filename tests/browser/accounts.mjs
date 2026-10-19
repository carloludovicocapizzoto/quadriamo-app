import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const OUT = process.env.ACCOUNT_EVIDENCE
if (!OUT) throw Error('Set ACCOUNT_EVIDENCE outside the repository')
await mkdir(OUT, {recursive:true})
const APP = 'http://127.0.0.1:5197/app/'
const API = 'http://127.0.0.1:59999'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const requests=[], results=[], errors=[]
const user = id => ({ id, aud:'authenticated', role:'authenticated', email:id+'@synthetic.invalid', email_confirmed_at:'2026-01-01T00:00:00Z',
  app_metadata:{provider:'email',providers:['email']}, user_metadata:{first_name:id===A?'SyntheticA':'SyntheticB',last_name:'Test'}, identities:[], created_at:'2026-01-01T00:00:00Z' })
const jwt = id => [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated',iss:API+'/auth/v1'})).toString('base64url'),'synthetic-signature'].join('.')
const session = id => ({access_token:jwt(id),refresh_token:'synthetic-refresh-'+id,expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:user(id)})
const owner = req => { try {return JSON.parse(Buffer.from((req.headers()['authorization']||'').split('.')[1],'base64url')).sub} catch {return null} }
const remote = new Map()
const revisions = new Map(), receipts = new Map()
let holdFetch=null, holdAuth=null, holdAvatar=null, networkOffline=false
async function intercept(route) {
  const req=route.request(), url=new URL(req.url())
  if(networkOffline) return route.abort()
  if (url.origin!==API) { if (url.origin===new URL(APP).origin) return route.continue(); return route.abort() }
  let body; try { body=req.postDataJSON() } catch { body=null }
  const uid=owner(req)
  requests.push({path:url.pathname,method:req.method(),owner:uid,body})
  const send=(data,status=200)=>route.fulfill({status,json:data,headers:{'access-control-allow-origin':'*'}})
  if (req.method()==='OPTIONS') return send({})
  if (holdAuth && url.pathname===holdAuth.path && req.method()===holdAuth.method) { const h=holdAuth;holdAuth=null;h.started();await h.wait }
  if (url.pathname==='/auth/v1/token') {
    const id=body?.email?.split('@')[0] || body?.refresh_token?.slice('synthetic-refresh-'.length)
    return send(session(id))
  }
  if (url.pathname==='/auth/v1/verify') return send(session(body.email.split('@')[0]))
  if (url.pathname==='/auth/v1/recover') return send({})
  if (url.pathname==='/auth/v1/user') return send({ ...user(uid), user_metadata:body?.data||user(uid).user_metadata })
  if (url.pathname==='/auth/v1/logout') return send({})
  if (url.pathname==='/rest/v1/rpc/qsync_read') {
    const revision=String(revisions.get(uid)||1), document=remote.get(uid)||null
    if(holdFetch?.owner===uid){const h=holdFetch;holdFetch=null;h.started();await h.wait;return send({protocol:1,mode:'protected',revision,document:h.response||document})}
    return send({protocol:1,mode:'protected',revision,document})
  }
  if (url.pathname==='/rest/v1/rpc/qsync_write') {
    const operation=uid+':'+body.p_operation
    if(receipts.has(operation))return send({...receipts.get(operation),replay:true})
    assert(!body.p_document.demo,'demo upload');assert(!JSON.stringify(body.p_document).includes(uid===A?'B-only':'A-only'),'cross-owner upload')
    const revision=String(revisions.get(uid)||1)
    if(body.p_expected_revision!==revision)return send({status:'conflict',revision,operation:body.p_operation,replay:false})
    const next=String(BigInt(revision)+1n),response={status:'applied',revision:next,operation:body.p_operation,replay:false}
    remote.set(uid,structuredClone(body.p_document));revisions.set(uid,next);receipts.set(operation,response);return send(response)
  }
  if (url.pathname==='/rest/v1/user_data') {
    if (req.method()==='GET') {
      if (holdFetch?.owner===uid) { const h=holdFetch;holdFetch=null;h.started();await h.wait;if(h.response)return send({data:h.response}) }
      return send(remote.has(uid)?{data:remote.get(uid)}:null)
    }
    assert.fail('product must never fall back to an unconditional REST writer')
  }
  if (holdAvatar && url.pathname.includes(holdAvatar.owner+'/avatar.webp') && req.method()==='GET') { const h=holdAvatar;holdAvatar=null;h.started();await h.wait;return route.fulfill({status:200,contentType:'image/png',body:h.image}) }
  if (url.pathname.startsWith('/storage/')) return req.method()==='POST' ? send({Key:'synthetic'}) : send({message:'not found'},404)
  if (url.pathname.includes('subscriptions')) return send(null)
  if (url.pathname.includes('profiles')) return send(null)
  if (url.pathname.includes('/rpc/')) return send(false)
  return send([])
}
const browser=await chromium.launch({executablePath:process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:JSON.parse(process.env.CHROME_ARGS||'[]')})
const context=await browser.newContext({viewport:{width:Number(process.env.ACCOUNT_WIDTH || 1280),height:900},reducedMotion:'reduce'})
await context.route('**/*',intercept)
await context.addInitScript(()=>{localStorage.setItem('quadriamo.lang','it');localStorage.setItem('q.installSkip','1')})
let page=await context.newPage()
page.on('pageerror',e=>errors.push(e.message))
page.on('dialog',d=>d.accept())
const snap=p=>p.evaluate(()=>window.accountTest?.snapshot())
const waitOwner=(p,id,kind='account')=>p.waitForFunction(({id,kind})=>window.accountTest?.snapshot().scope.owner===id && window.accountTest?.snapshot().scope.kind===kind,{id,kind})
async function check(name,fn) {const at=Date.now();try{await fn();results.push({name,pass:true,ms:Date.now()-at});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.stack});await page.screenshot({path:OUT+'/failure.png',fullPage:true});throw e}}
try {
 await page.goto(APP);await page.waitForFunction(()=>!!window.accountTest)
 console.log('PROBE',await page.locator('[data-testid=owner]').textContent())
 remote.set(A,await page.evaluate(()=>window.accountTest.initial('A-only')))
 remote.set(B,await page.evaluate(()=>window.accountTest.initial('B-only')))
 await check('login A actual SDK / synthetic HTTP',async()=>{await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A);await page.waitForFunction(()=>window.accountTest.snapshot().state.state.data?.transactions.some(x=>x.id==='A-only'))})
 await page.screenshot({path:OUT+'/desktop.png',fullPage:true})
 await page.evaluate(()=>window.accountTest.preload())
 await check('offline edit persisted in A',async()=>{networkOffline=true;await context.setOffline(true);await page.evaluate(async()=>{window.accountTest.add('A-offline');await window.accountTest.flush()});assert((await snap(page)).state.state.data.transactions.some(x=>x.id==='A-offline'))})
 await check('logout offline',async()=>{await page.evaluate(()=>window.accountTest.signOut().catch(e=>e.message));await waitOwner(page,null,'guest')})
 networkOffline=false;await context.setOffline(false)
 await check('B cannot load A, return A retains edit',async()=>{await page.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B);await page.waitForFunction(()=>window.accountTest.snapshot().state.state.data?.transactions.some(x=>x.id==='B-only'));assert(!(await page.textContent('body')).includes('A-only'));await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A);assert((await snap(page)).state.state.data.transactions.some(x=>x.id==='A-offline'))})

 await check('demo isolated from account, return preserves A',async()=>{
   await page.evaluate(()=>window.accountTest.demo());await waitOwner(page,A,'demo')
   await page.evaluate(async()=>{window.accountTest.add('DEMO-only');await window.accountTest.flush()})
   await page.evaluate(()=>window.accountTest.exit());await waitOwner(page,A)
   assert(!(await snap(page)).state.state.data.transactions.some(x=>x.id==='DEMO-only'))
 })
 await check('late JSON and CSV imports do not enter B',async()=>{
   for(const format of ['json','csv']) {
     if((await snap(page)).scope.owner!==A) {await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A)}
     const data=await page.evaluate(()=>window.accountTest.initial('A-only-stale-import'))
     await page.evaluate(()=>{const original=File.prototype.text;window.releaseFile=null;File.prototype.text=async function(){const text=await original.call(this);await new Promise(r=>window.releaseFile=r);return text};window.restoreFile=()=>{File.prototype.text=original}})
     await page.locator('[data-testid=test-imports]').evaluate(el=>el.open=true)
     await page.locator('[data-testid='+format+'-import] input[type=file]').first().setInputFiles({name:'synthetic.'+format,mimeType:format==='json'?'application/json':'text/csv',buffer:Buffer.from(format==='json'?JSON.stringify(data):'Date,Description,Amount,Currency\n2026-10-18,A-only-stale-import,-12,EUR')})
     await page.waitForFunction(()=>!!window.releaseFile)
     const other=await context.newPage();await other.goto(APP);await waitOwner(other,A)
     await other.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await waitOwner(other,null,'guest')
     await other.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B)
     await page.evaluate(()=>{window.releaseFile();window.restoreFile()})
     assert(!(await snap(page)).state.state.data.transactions.some(x=>x.id==='A-only-stale-import'))
     assert(!(await snap(page)).state.state.data.inbox?.some(x=>x.description==='A-only-stale-import'))
     await other.close()
   }
 })
 await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A)
 await check('quota error retains pending data, blocks logout and permits retry',async()=>{
   await page.evaluate(()=>{window.failCacheWrites=true;window.accountTest.add('A-unsaved')})
   await page.waitForFunction(()=>window.accountTest.snapshot().state.error==='save')
   assert(await page.getByRole('alert').count())
   const error=await page.evaluate(()=>window.accountTest.signOut().then(()=>null,e=>e.message))
   assert(error);await waitOwner(page,A)
   await page.evaluate(async()=>{window.failCacheWrites=false;await window.accountTest.retry()})
   assert(!(await snap(page)).state.dirty)
 })
 await check('notification safety gate still exports unsaved data of the current owner',async()=>{
   await page.evaluate(()=>{
     const service=navigator.serviceWorker;window.restoreRegistrations=service.getRegistrations.bind(service)
     service.getRegistrations=async()=>[{scope:location.origin+'/',active:{scriptURL:location.origin+'/sw.js'},getNotifications:async()=>[],pushManager:{getSubscription:async()=>null},unregister:async()=>false}]
     window.failCacheWrites=true;window.accountTest.add('A-push-gate-unsaved')
   })
   await page.waitForFunction(()=>window.accountTest?.snapshot().state.error==='save')
   await page.evaluate(()=>window.accountTest.signOut().catch(e=>e.message))
   const alert=page.getByRole('alert').filter({hasText:'vecchie notifiche'})
   await alert.waitFor()
   const pending=page.waitForEvent('download');await alert.getByRole('button',{name:'Esporta copia di recupero'}).click()
   const download=await pending;await download.saveAs(OUT+'/gate-recovery.json')
   const recovered=JSON.parse(await (await import('node:fs/promises')).readFile(OUT+'/gate-recovery.json','utf8'))
   assert(recovered.transactions.some(x=>x.id==='A-push-gate-unsaved'))
   assert(!recovered.transactions.some(x=>x.id==='B-only'))
   await page.evaluate(()=>{navigator.serviceWorker.getRegistrations=window.restoreRegistrations;window.failCacheWrites=false})
   await alert.getByRole('button',{name:'Riprova',exact:true}).click();await waitOwner(page,A)
   await page.evaluate(()=>window.accountTest.retry())
 })
 await check('avatar and preferences stay with their owner',async()=>{
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=4;c.getContext('2d').fillRect(0,0,4,4);return c.toDataURL().split(',')[1]})
   await page.evaluate(async png=>{window.accountTest.preference('A-private-budget');await window.accountTest.uploadAvatar(png)},png)
   await page.waitForFunction(()=>window.accountTest.snapshot().avatar?.startsWith('data:'))
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B)
   assert.equal((await snap(page)).avatar,null);assert.equal(await page.evaluate(()=>window.accountTest.getPreference()),null)
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A)
   assert((await snap(page)).avatar);assert.equal(await page.evaluate(()=>window.accountTest.getPreference()),'A-private-budget')
   let release,started;const wait=new Promise(r=>release=r),begun=new Promise(r=>started=r)
   holdAvatar={owner:A,image:Buffer.from(png,'base64'),wait,started}
   await page.evaluate(id=>{window.avatarPending=window.accountTest.avatar(id).catch(e=>e.message)},A);await begun
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B)
   release();await page.evaluate(()=>window.avatarPending);assert.equal((await snap(page)).avatar,null)
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A)
 })
 await check('denied IndexedDB read never becomes an empty account',async()=>{
   await page.evaluate(()=>sessionStorage.setItem('failCacheReads','yes'));await page.reload()
   await page.getByRole('alert').filter({hasText:'leggere'}).waitFor()
   assert.equal(await page.locator('[data-testid=probe]').count(),0)
   await page.evaluate(()=>sessionStorage.removeItem('failCacheReads'))
   await page.getByRole('button',{name:'Riprova',exact:true}).click();await waitOwner(page,A)
   assert((await snap(page)).state.state.data.transactions.some(x=>x.id==='A-only'))
 })
 await check('legacy preserved, never assigned, explicit recovery never uploaded',async()=>{
   const legacy=await page.evaluate(()=>window.accountTest.initial('LEGACY-UNOWNED'))
   await page.evaluate(data=>new Promise((ok,bad)=>{const r=indexedDB.open('keyval-store');r.onsuccess=()=>{const tx=r.result.transaction('keyval','readwrite');tx.objectStore('keyval').put(data,'quadriamo.data.v1');tx.oncomplete=ok;tx.onerror=bad}}),legacy)
   await page.reload();await waitOwner(page,A)
   assert(!(await page.textContent('body')).includes('LEGACY-UNOWNED'))
   await page.getByRole('button',{name:'Recupera dati locali precedenti'}).click()
   const count=requests.filter(x=>x.path==='/rest/v1/rpc/qsync_write').length
   await page.getByRole('button',{name:'Apri copia locale',exact:true}).click()
   await page.waitForFunction(()=>window.accountTest?.snapshot().scope.kind==='recovery')
   assert((await page.textContent('body')).includes('LEGACY-UNOWNED'))
   await page.evaluate(()=>window.accountTest.flush())
   assert.equal(requests.filter(x=>x.path==='/rest/v1/rpc/qsync_write').length,count)
   await page.getByRole('button',{name:'Torna',exact:true}).first().click();await waitOwner(page,A)
   const original=await page.evaluate(()=>new Promise(ok=>{const r=indexedDB.open('keyval-store');r.onsuccess=()=>{const q=r.result.transaction('keyval').objectStore('keyval').get('quadriamo.data.v1');q.onsuccess=()=>ok(q.result)}}))
   assert.deepEqual(original,legacy)
 })
 await check('two real tabs retain both sides of a revision conflict',async()=>{
   const other=await context.newPage();await other.goto(APP);await waitOwner(other,A)
   networkOffline=true;await context.setOffline(true)
   await Promise.all([page.evaluate(async()=>{window.accountTest.add('A-tab-one');try{await window.accountTest.flush()}catch{}}),other.evaluate(async()=>{window.accountTest.add('A-tab-two');try{await window.accountTest.flush()}catch{}})])
   const states=await Promise.all([snap(page),snap(other)])
   assert(states.some(x=>x.state.error==='conflict'),'must expose the losing concurrent edit')
   for(const [i] of [page,other].entries()) assert(states[i].state.state.data.transactions.some(x=>x.id===(i===0?'A-tab-one':'A-tab-two')))
   const loser=states[0].state.dirty?page:other
   const download=loser.waitForEvent('download');await loser.getByRole('alert').getByRole('button',{name:'Esporta copia di recupero'}).click();await(await download).saveAs(OUT+'/conflict-recovery.json')
   const exported=JSON.parse(await (await import('node:fs/promises')).readFile(OUT+'/conflict-recovery.json','utf8'));assert(exported.transactions.some(x=>x.id===(loser===page?'A-tab-one':'A-tab-two')))
   networkOffline=false;await context.setOffline(false)
   const controller=await context.newPage();await controller.goto(APP);await waitOwner(controller,A)
   await controller.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await waitOwner(other,null,'guest');await waitOwner(controller,null,'guest')
   await controller.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B);await waitOwner(other,B)
   assert(!(await page.textContent('body')).includes('A-tab-'));assert(!(await other.textContent('body')).includes('A-tab-'))
   await other.close();await controller.close();await page.close()
   // The losing in-memory branch was exported above; a fresh page tests later scenarios independently.
   page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(APP);await waitOwner(page,B)
 })
 await check('real IndexedDB contains distinct owner and legacy keys',async()=>{
   const entries=await page.evaluate(()=>new Promise(ok=>{const r=indexedDB.open('keyval-store');r.onsuccess=()=>{const store=r.result.transaction('keyval').objectStore('keyval');const keys=store.getAllKeys(),values=store.getAll();values.onsuccess=()=>ok(keys.result.map((k,i)=>[k,values.result[i]]))}}))
   await writeFile(OUT+'/indexeddb.json',JSON.stringify(entries,null,2))
   assert(entries.some(([key])=>key==='quadriamo.data.v1'));assert(entries.some(([key])=>key==='quadriamo.legacy.v2'))
   for(const [key,value]of entries.filter(([key])=>key.startsWith('quadriamo.data.v2/'))) {
     const scope=JSON.parse(decodeURIComponent(key.slice('quadriamo.data.v2/'.length)))
     if(scope[2]==='account') assert(!JSON.stringify(value).includes(scope[3]===A?'B-only':'A-only'))
   }
 })
 await check('old A fetch is ignored after A→B→A',async()=>{
   const fresh=await context.newPage();await fresh.goto(APP);await waitOwner(fresh,B)
   await fresh.evaluate(()=>window.accountTest.signOut());await waitOwner(fresh,null,'guest');await waitOwner(page,null,'guest')
   await fresh.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(fresh,A);await waitOwner(page,A)
   // Start after the initial sync so the controlled request is this session's explicit refresh.
   await fresh.evaluate(()=>window.accountTest.sync());let release,started
   const wait=new Promise(r=>release=r), begun=new Promise(r=>started=r)
   holdFetch={owner:A,wait,started,response:await fresh.evaluate(()=>window.accountTest.initial('STALE-A-FIRST'))}
   await fresh.evaluate(()=>{window.pendingSync=window.accountTest.sync()});await begun
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await waitOwner(fresh,null,'guest')
   await page.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B);await waitOwner(fresh,B)
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await waitOwner(fresh,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A);await waitOwner(fresh,A)
   release();await fresh.evaluate(()=>window.pendingSync)
   assert(!(await fresh.textContent('body')).includes('STALE-A-FIRST'))
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await waitOwner(fresh,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B)
   await fresh.close()
 })
 await check('auth response arriving after B cannot overwrite the new session',async()=>{
   const fresh=await context.newPage();await fresh.goto(APP);await waitOwner(fresh,B)
   await fresh.evaluate(()=>window.accountTest.signOut());await waitOwner(fresh,null,'guest');await waitOwner(page,null,'guest')
   let release,started;const wait=new Promise(r=>release=r), begun=new Promise(r=>started=r)
   holdAuth={path:'/auth/v1/token',method:'POST',wait,started}
   await fresh.evaluate(id=>{window.pendingLogin=window.accountTest.signIn(id).catch(e=>e.message)},A);await begun
   await page.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B);await waitOwner(fresh,B)
   release();await fresh.evaluate(()=>window.pendingLogin)
   assert.equal((await snap(fresh)).scope.owner,B)
   await fresh.close()
 })
 await check('late refresh token response does not restore the previous account',async()=>{
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A)
   const other=await context.newPage();await other.goto(APP);await waitOwner(other,A)
   let release,started;const wait=new Promise(r=>release=r),begun=new Promise(r=>started=r)
   holdAuth={path:'/auth/v1/token',method:'POST',wait,started}
   await page.evaluate(()=>{window.refreshPending=window.accountTest.auth.refreshSession().catch(e=>e.message)});await begun
   await other.evaluate(()=>window.accountTest.signOut());await waitOwner(other,null,'guest');await waitOwner(page,null,'guest')
   await other.evaluate(id=>window.accountTest.signIn(id),B);await waitOwner(page,B);await waitOwner(other,B)
   release();await page.evaluate(()=>window.refreshPending)
   assert.equal((await snap(page)).scope.owner,B);await other.close()
 })
 await check('valid profile and recovery commands retain the intended owner',async()=>{
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest')
   await page.evaluate(id=>window.accountTest.resetPassword(id+'@synthetic.invalid'),A)
   await page.evaluate(id=>window.accountTest.verifyRecovery(id+'@synthetic.invalid','123456'),A);await waitOwner(page,A)
   await page.evaluate(()=>window.accountTest.updatePassword('Synthetic-new-password-42'))
   await page.evaluate(async()=>{try{await window.accountTest.updateNames('SyntheticUpdated','Test')}catch(e){throw Error([e?.name,e?.message,e?.code,e?.status].filter(Boolean).join(': '))}})
   assert.equal((await snap(page)).scope.owner,A)
   assert(requests.some(r=>r.path==='/auth/v1/user'&&r.method==='PUT'&&r.owner===A&&r.body?.data?.first_name==='SyntheticUpdated'))
 })
 await check('auth mutation cannot adopt a different stored session before its auth event',async()=>{
   await page.evaluate(()=>window.accountTest.signOut());await waitOwner(page,null,'guest');await page.evaluate(id=>window.accountTest.signIn(id),A);await waitOwner(page,A)
   const from=requests.length
   await page.evaluate(async s=>{const api=window.accountTest;const key=Object.keys(localStorage).find(k=>k.startsWith('q.auth.v1/'));const record=JSON.parse(localStorage.getItem(key));record.generation=crypto.randomUUID();record.session=JSON.stringify(s);localStorage.setItem(key,JSON.stringify(record));try{await api.updateNames('A-only-private-name','Test')}catch{}},session(B))
   assert(!requests.slice(from).some(r=>r.path==='/auth/v1/user'&&r.method==='PUT'&&r.owner===B),'A name was sent with B token')
 })
} finally {
 await writeFile(OUT+'/accounts.json',JSON.stringify({results,errors,requests},null,2))
 console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),errors},null,2))
 await browser.close()
}
