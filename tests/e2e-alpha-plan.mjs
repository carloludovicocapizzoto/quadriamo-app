import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const root=process.cwd(),origin='http://127.0.0.1:4196',out=resolve('dist-alpha-plan-e2e')
const {openChrome,sleep}=await import(pathToFileURL(resolve('tools/chrome.mjs')))
const {startFakeAlpha,USERS}=await import(pathToFileURL(resolve('tests/fake-alpha.mjs')))
const build=process.env.E2E_NO_BUILD ? {status:0} : spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','alpha','--outDir',out,'--logLevel','error'],{cwd:root,stdio:'inherit',env:{...process.env,BASE_PATH:'/',VITE_SUPABASE_URL:origin,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_local',VITE_FLAGS:'cloud:news,monthly-plan',VITE_VAPID_PUBLIC_KEY:''}})
if(build.status!==0)throw Error('diagnostic build failed')
const item={id:'QA-2H-NEWS-001',title:'Inflazione e risparmio: notizia sintetica QA-2H',excerpt:null,link:'https://example.invalid/qa-2h',thumb:null,published:new Date().toISOString(),lang:'it',format:'article',categories:['personal','economy'],level:'beginner',minutes:3,relevance:0.9,cluster:null,crypto:false,source:{name:'Fonte sintetica',kind:'institution',paywall:false,trust:5,country:'IT'}}
const imageHost='https://qa-covers.example.com',good=imageHost+'/synthetic.svg',bad=imageHost+'/missing.svg',redirect=imageHost+'/redirect.svg',evil='https://qa-redirect.example.net/target.svg'
const rights={images:true,rights_reference:'https://source.example.com/headline-rights',image_rights_reference:'https://source.example.com/image-licence',image_attribution:'Synthetic image author, CC BY 4.0, unchanged',image_attribution_required:true,image_hosts:['qa-covers.example.com'],image_rights_scope:'approved-urls',image_approved_urls:[good,bad,redirect]}
const variants=[item,...[[good,true,'GOOD'],[bad,true,'BAD'],[redirect,true,'REDIRECT'],[imageHost+'/unauthorized.svg',false,'DENIED']].map(([thumb,allowed,id])=>({...item,id:'QA-2I-'+id,title:'Inflazione e risparmio: copertina sintetica '+id,thumb,source:{...item.source,...rights,images:allowed}})),{...item,id:'QA-2I-NO-RIGHTS',title:'Notizia sintetica senza diritti immagine',categories:['personal'],thumb:imageHost+'/no-rights.svg',source:{...item.source,rights_reference:'https://source.example.com/headline-rights',images:false}}]
const server=await startFakeAlpha({port:4196,fixtures:{v1:out},news:true,newsItems:variants})
let c;const requests=[],externalImageAttempts=[],isExternal=url=>{const u=new URL(url);return (u.protocol==='https:'||u.protocol==='http:')&&u.origin!==origin};const until=async(f,n=100)=>{for(let i=0;i<n;i++){if(await f())return;await sleep(150)}throw Error('condition timeout')}
try{
 c=await openChrome({port:9486,onEvent:async m=>{if(m.method==='Network.requestWillBeSent'){requests.push(m.params.request.url);if(m.params.type==='Image'&&isExternal(m.params.request.url))externalImageAttempts.push(m.params.request.url)}if(m.method==='Fetch.requestPaused'){const url=m.params.request.url;if(isExternal(url)){externalImageAttempts.push(url);if(url===redirect)await c.cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:302,responseHeaders:[{name:'Location',value:evil}]});else await c.cdp('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'})}else await c.cdp('Fetch.continueRequest',{requestId:m.params.requestId})}}})
 await c.cdp('Network.enable');await c.cdp('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Image'}]});await c.cdp('Page.navigate',{url:origin+'/app/'});await sleep(1600)
 await c.js("localStorage.setItem('quadriamo.lang','it');localStorage.removeItem('q.newsFilter')");await c.cdp('Page.reload');await sleep(1200)
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
 if(!await c.js("document.body.innerText.includes('Obiettivo giornaliero pianificato')&&document.body.innerText.includes('Disponibilità registrata')"))throw Error('B labelling missing')
 const widget=await c.js("({rows:document.querySelectorAll('.w-forecast .plan-budget-row').length,title:document.querySelector('.w-forecast .w-title')?.innerText,body:document.querySelector('.w-forecast')?.innerText})")
 if(widget.rows!==4||!widget.title||widget.body.split(widget.title).length!==2||widget.body.includes('Obiettivo giornaliero'))throw Error('monthly budget widget is not concise '+JSON.stringify(widget))
 const original=structuredClone(doc),applyFixture=async(balance,received,tx=[])=>{
  const h=server.state.heads.get(USERS.B.id),document=structuredClone(original),shares=document.settings.buckets.reduce((n,b)=>n+b.share,0)
  document.settings.buckets=document.settings.buckets.map(b=>({...b,startingBalance:balance*b.share/shares}))
  document.settings.openingIncomeReceived=received?1500:0
  document.transactions=tx.map((amount,i)=>({id:'QA-2I-INCOME-'+i,date:document.settings.balanceDate,amount,description:'Synthetic tranche/extra',category:i===tx.length-1&&tx.length===3?'extraIncome':'salary'}))
  server.state.heads.set(USERS.B.id,{revision:h.revision+1,document})
  await c.cdp('Page.reload');await until(()=>c.js("!!document.querySelector('[data-testid=plan-availability]')"));await sleep(1200)
  if(await c.js("document.querySelector('.hero-amount').innerText")!==target)throw Error('opening balance or received income changed planned Home target')
 }
 await applyFixture(100,true)
 if(!await c.js("!!document.querySelector('[data-testid=plan-alert]')"))throw Error('financial shortfall did not show the warning')
 const lowAvailability=await c.js("document.querySelector('.plan-availability-line').innerText")
 await applyFixture(10000,true)
 if(await c.js("!!document.querySelector('[data-testid=plan-alert]')"))throw Error('sufficient recorded availability still shows a warning')
 const highAvailability=await c.js("document.querySelector('.plan-availability-line').innerText")
 if(lowAvailability===highAvailability)throw Error('opening balance fixture did not change recorded availability')
 await applyFixture(1000,true)
 const sameCashReceived=await c.js("document.querySelector('.plan-availability-line').innerText")
 await applyFixture(1000,false)
 if(await c.js("!!document.querySelector('[data-testid=plan-alert]')"))throw Error('expected future income was mistaken for an overall plan shortfall')
 if(await c.js("document.querySelector('.plan-availability-line').innerText")!==sameCashReceived)throw Error('expected future income was shown as current availability')
 let previousAvailability=await c.js("document.querySelector('[data-testid=plan-availability]').innerText")
 for(const tx of [[100],[100,500],[100,500,300]]){
  await applyFixture(1000,false,tx)
  const availability=await c.js("document.querySelector('[data-testid=plan-availability]').innerText");if(availability===previousAvailability)throw Error('remote fixture was not applied to availability');previousAvailability=availability
 }
 const labels={it:'Disponibilità registrata',en:'Recorded availability',fr:'Disponibilité enregistrée',es:'Disponibilidad registrada'}
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  await c.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await c.js(`document.documentElement.dataset.theme='${theme}'`);await sleep(250)
  const layout=await c.js("({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,home:document.querySelector('.home')?.getBoundingClientRect(),hero:document.querySelector('.hero-amount')?.getBoundingClientRect(),availability:document.querySelector('[data-testid=plan-availability]')?.getBoundingClientRect(),font:parseFloat(getComputedStyle(document.querySelector('.plan-availability-line')).fontSize),widget:document.querySelector('.w-forecast')?.getBoundingClientRect(),widgetOverflow:document.querySelector('.w-forecast')?.scrollWidth>document.querySelector('.w-forecast')?.clientWidth+1})")
  if(layout.overflow||layout.widgetOverflow||layout.font<12||layout.hero.left<0||layout.hero.right>layout.width+1||layout.availability.left<0||layout.availability.right>layout.width+1)throw Error('Home responsive/theme check '+width+'/'+theme+' '+JSON.stringify(layout))
 }
 for(const [lang,label] of Object.entries(labels)){
  await c.js(`localStorage.setItem('quadriamo.lang','${lang}')`);await c.cdp('Page.reload');await until(()=>c.js(`document.body.innerText.includes('${label}')`));await sleep(300)
  await c.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  const layout=await c.js("({overflow:document.documentElement.scrollWidth>innerWidth+1,widgetOverflow:document.querySelector('.w-forecast')?.scrollWidth>document.querySelector('.w-forecast')?.clientWidth+1,font:parseFloat(getComputedStyle(document.querySelector('.plan-availability-line')).fontSize)})")
  if(layout.overflow||layout.widgetOverflow||layout.font<12)throw Error('Home localization check '+lang+' '+JSON.stringify(layout))
 }
 await c.js("localStorage.setItem('quadriamo.lang','it')");await c.cdp('Page.reload');await until(()=>c.js("document.body.innerText.includes('Disponibilità registrata')"))
 await c.js("location.hash='#/news'")
 const visible=()=>c.js("document.body.innerText.includes('notizia sintetica QA-2H')")
 await until(visible)
 if(!requests.some(u=>u.startsWith(origin+'/api/rest/news_items')))throw Error('no news gateway read')
 if(requests.some(u=>u.includes('/functions/v1/news')))throw Error('legacy news fallback used')
 await c.cdp('Page.reload');await until(visible);await sleep(1500)
 if(externalImageAttempts.length)throw Error('Alpha made prohibited external image request(s): '+JSON.stringify(externalImageAttempts))
 const covers=await c.js("({images:document.querySelectorAll('.news-cover img').length,fallbacks:document.querySelectorAll('.news-cover-art').length,stories:document.querySelectorAll('.story').length,overflow:document.documentElement.scrollWidth>innerWidth+1})")
 if(covers.images!==0||covers.fallbacks<covers.stories||covers.overflow)throw Error('Alpha cover fallback/safety rendering '+JSON.stringify(covers))
 await c.js("document.querySelector('.filter-btn')?.click()");await until(()=>c.js("!!document.querySelector('.news-filters-panel')"))
 await c.js("[...document.querySelectorAll('.nf-group')].flatMap(g=>[...g.querySelectorAll('button')]).find(b=>b.innerText==='Economia')?.click()");await until(()=>c.js("[...document.querySelectorAll('.nf-group button')].some(b=>b.innerText==='Economia'&&b.getAttribute('aria-pressed')==='true')"))
 await c.js("document.querySelector('.nf-actions .btn.primary')?.click()");await sleep(500)
 const filtered=await c.js("[...document.querySelectorAll('.story-title')].map(x=>x.innerText)")
 if(!filtered.length||filtered.some(x=>x.includes('senza diritti immagine')))throw Error('news topic filter did not filter sections')
 await c.js("[...document.querySelectorAll('.story')].find(x=>x.innerText.includes('GOOD')).click()");await sleep(500)
 const detail=await c.js("({fallback:!!document.querySelector('.story-detail .news-cover-art'),img:!!document.querySelector('.story-detail img.story-hero'),imageCredit:!!document.querySelector('.news-credit'),titleRights:[...document.querySelectorAll('.story-detail a')].some(a=>a.href.includes('headline-rights')),text:document.querySelector('.story-detail')?.innerText})")
 if(!detail.fallback||detail.img||detail.imageCredit||!detail.titleRights||detail.text.includes('Synthetic image author'))throw Error('news fallback attribution does not match displayed content '+JSON.stringify(detail))
 await c.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});await c.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape'});await sleep(750)
 await c.js("localStorage.removeItem('q.newsFilter');location.reload()");await until(visible);await sleep(300)
 const allStories=await c.js("document.querySelectorAll('.story').length")
 if(allStories<covers.stories)throw Error('news reload/filter reset lost synthetic stories')
 if(externalImageAttempts.length)throw Error('external cover/redirect was requested: '+JSON.stringify(externalImageAttempts))
 console.log(JSON.stringify({classification:'SIMULATED',passed:['complete planned onboarding -> snapshot without fictitious income -> CAS persistence','B target stable across balances, future income, tranches and extras; shortfall alert positive/negative; 320/390/768/1440 light/dark; IT/EN/FR/ES','authenticated Alpha frontend -> news gateway -> synthetic backend','month budget widget has one heading and four aligned facts','news filter, sections, detail, reload and fallback for good/missing/redirect/denied/no-rights covers','no image element, image credit for fallback, external request or redirect; title-rights attribution retained','no legacy Edge Function call'],cloudWrites:0,realAccounts:0,externalImageAttempts}))
}catch(e){console.log('Diagnostic UI:',(await c?.js('document.body.innerText'))?.slice(0,800));throw e}finally{await c?.close();await server.close()}
