import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const root=process.cwd(),origin='http://127.0.0.1:4196',out=resolve('dist-alpha-plan-e2e')
const {openChrome,sleep}=await import(pathToFileURL(resolve('tools/chrome.mjs')))
const {startFakeAlpha,USERS}=await import(pathToFileURL(resolve('tests/fake-alpha.mjs')))
const build=process.env.E2E_NO_BUILD ? {status:0} : spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','alpha','--outDir',out,'--logLevel','error'],{cwd:root,stdio:'inherit',env:{...process.env,BASE_PATH:'/',VITE_SUPABASE_URL:origin,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_local',VITE_FLAGS:'cloud:news,monthly-plan',VITE_VAPID_PUBLIC_KEY:''}})
if(build.status!==0)throw Error('diagnostic build failed')
const item={id:'QA-2H-NEWS-001',title:'Inflazione e risparmio: notizia sintetica QA-2H',excerpt:null,link:'https://example.invalid/qa-2h',thumb:null,published:new Date().toISOString(),lang:'it',format:'article',categories:['personal','economy'],level:'beginner',minutes:3,relevance:0.9,cluster:null,crypto:false,source:{name:'Fonte sintetica',kind:'institution',paywall:false,trust:5,country:'IT'}}
const imageHost='https://qa-covers.example.com',good=imageHost+'/synthetic.svg',bad=imageHost+'/missing.svg'
const rights={images:true,image_rights_reference:'https://source.example.com/licence',image_attribution:'Synthetic author, CC BY 4.0, unchanged',image_attribution_required:true,image_hosts:['qa-covers.example.com'],image_rights_scope:'approved-urls',image_approved_urls:[good,bad]}
const variants=[item,...[[good,true,'GOOD'],[bad,true,'BAD'],[imageHost+'/unauthorized.svg',false,'DENIED']].map(([thumb,allowed,id])=>({...item,id:'QA-2I-'+id,title:'Inflazione e risparmio: copertina sintetica '+id,thumb,source:{...item.source,...rights,images:allowed}}))]
const server=await startFakeAlpha({port:4196,fixtures:{v1:out},news:true,newsItems:variants})
let c;const requests=[];const until=async(f,n=100)=>{for(let i=0;i<n;i++){if(await f())return;await sleep(150)}throw Error('condition timeout')}
try{
 c=await openChrome({port:9486,onEvent:async m=>{if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);if(m.method==='Fetch.requestPaused'){const ok=m.params.request.url===good;await c.cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:ok?200:404,responseHeaders:[{name:'Content-Type',value:'image/svg+xml'}],body:Buffer.from(ok?'<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76"><rect width="76" height="76" fill="#446688"/></svg>':'synthetic missing').toString('base64')})}}})
 await c.cdp('Network.enable');await c.cdp('Fetch.enable',{patterns:[{urlPattern:imageHost+'/*'}]});await c.cdp('Page.navigate',{url:origin+'/app/'});await sleep(1600)
 await c.js("localStorage.setItem('quadriamo.lang','it')");await c.cdp('Page.reload');await sleep(1200)
 await c.js("document.querySelector('.gate-cta')?.click()");await sleep(700);await c.js("document.querySelector('.inst-skip')?.click()");await sleep(700)
 await until(()=>c.js("!!document.querySelector('input[type=email]')"))
 await c.js("document.querySelector('input[type=email]').focus()");await c.cdp('Input.insertText',{text:USERS.B.email})
 await c.js("document.querySelector('form .btn.primary').click()");await sleep(650)
 await c.js("document.querySelector('input[type=password]').focus()");await c.cdp('Input.insertText',{text:USERS.B.password})
 await c.js("document.querySelector('form .btn.primary').click()");await sleep(2000)
 await until(()=>c.js("!!document.querySelector('.onboarding')"))
 await c.js("document.querySelector('.onboarding .btn.primary')?.click()");await sleep(700);await c.js("document.querySelector('.persona-row')?.click()");await sleep(500)
 for(let i=0;i<17&&!await c.js("!!document.querySelector('.tabbar')");i++){
 if(await c.js("!!document.querySelector('[data-testid=plan-opening]')")){
  const inputs="[...document.querySelectorAll('[data-testid=plan-opening] input[inputmode=decimal]')]"
  await c.js(inputs+"[0].focus()");await c.cdp('Input.insertText',{text:'1500'});await c.js(inputs+"[1].focus()");await c.cdp('Input.insertText',{text:'1000'});
  await c.js("document.querySelector('[data-testid=plan-opening] input[type=checkbox]').click();document.querySelector('[data-testid=plan-opening] button').click()");await sleep(300)
 }
 await c.js("document.querySelector('.step-nav .btn.primary')?.click()");await sleep(450)
 }
 const doc=server.state.heads.get(USERS.B.id)?.document
 if(!doc||doc.transactions.length||doc.settings.planVersion!==1||doc.settings.buckets.reduce((a,b)=>a+b.startingBalance,0)!==1000)throw Error('opening snapshot persisted incorrectly')
 if(await c.js("/A questo ritmo|a questo ritmo/.test(document.body.innerText)"))throw Error('pace projection in new plan')
 await until(()=>c.js("!!document.querySelector('.tabbar')"));await c.js("location.hash='#/home'");await until(()=>c.js("!!document.querySelector('[data-testid=plan-availability]')"));await sleep(1600)
 const target=await c.js("document.querySelector('.hero-amount').innerText")
 if(!await c.js("document.body.innerText.includes('Obiettivo giornaliero pianificato')&&document.body.innerText.includes('non è un saldo bancario certificato')"))throw Error('B labelling missing')
 let previousAvailability=await c.js("document.querySelector('[data-testid=plan-availability]').innerText")
 for(const tx of [[100],[100,500],[100,500,300]]){
  const h=server.state.heads.get(USERS.B.id),document=structuredClone(h.document),date=document.settings.balanceDate
  document.transactions=tx.map((amount,i)=>({id:'QA-2I-INCOME-'+i,date,amount,description:'Synthetic tranche/extra',category:i===2?'extraIncome':'salary'}))
  server.state.heads.set(USERS.B.id,{revision:h.revision+1,document});await c.cdp('Page.reload');await until(()=>c.js("!!document.querySelector('[data-testid=plan-availability]')"));await sleep(1800)
  if(await c.js("document.querySelector('.hero-amount').innerText")!==target)throw Error('salary tranche or extra changed planned Home target')
  const availability=await c.js("document.querySelector('[data-testid=plan-availability]').innerText");if(availability===previousAvailability)throw Error('remote fixture was not applied to availability');previousAvailability=availability
 }
 for(const width of [320,390]){await c.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);if(await c.js("document.documentElement.scrollWidth>innerWidth+1"))throw Error('Home plan overflow '+width)}
 await c.js("location.hash='#/news'")
 const visible=()=>c.js("document.body.innerText.includes('notizia sintetica QA-2H')")
 await until(visible)
 if(!requests.some(u=>u.startsWith(origin+'/api/rest/news_items')))throw Error('no news gateway read')
 if(requests.some(u=>u.includes('/functions/v1/news')))throw Error('legacy news fallback used')
 await c.cdp('Page.reload');await until(visible);await sleep(1500)
 if(requests.some(u=>u===imageHost+'/unauthorized.svg'))throw Error('unapproved cover fetched')
 if(!requests.includes(good)||!requests.includes(bad))throw Error('synthetic cover paths not exercised')
 const covers=await c.js("({images:document.querySelectorAll('.news-cover img').length,fallbacks:document.querySelectorAll('.news-cover-art').length,overflow:document.documentElement.scrollWidth>innerWidth+1})")
 if(covers.images<1||covers.fallbacks<2||covers.overflow)throw Error('cover/fallback rendering '+JSON.stringify(covers))
 await c.js("[...document.querySelectorAll('.story')].find(x=>x.innerText.includes('GOOD')).click()");await sleep(500)
 if(!await c.js("document.body.innerText.includes('Synthetic author')&&document.body.innerText.includes('Diritti immagine')"))throw Error('image credit missing')
 console.log(JSON.stringify({classification:'SIMULATED',passed:['complete planned onboarding -> snapshot without fictitious income -> CAS persistence','B main planned target stable across salary tranches and explicit extras; separate availability and 320/390 layout; no pace projection','authenticated Alpha frontend -> news gateway -> synthetic backend','real frontend flag enabled only in diagnostic build','news cache after reload','no legacy Edge Function call','synthetic approved cover + missing/error/denied fallback + attribution; no unauthorized image fetch'],cloudWrites:0,realAccounts:0}))
}catch(e){console.log('Diagnostic UI:',(await c?.js('document.body.innerText'))?.slice(0,800));throw e}finally{await c?.close();await server.close()}
