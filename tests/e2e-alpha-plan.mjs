import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const root=process.cwd(),origin='http://127.0.0.1:4196',out=resolve('dist-alpha-plan-e2e')
const {openChrome,sleep}=await import(pathToFileURL(resolve('tools/chrome.mjs')))
const {startFakeAlpha,USERS}=await import(pathToFileURL(resolve('tests/fake-alpha.mjs')))
const build=process.env.E2E_NO_BUILD ? {status:0} : spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','alpha','--outDir',out,'--logLevel','error'],{cwd:root,stdio:'inherit',env:{...process.env,BASE_PATH:'/',VITE_SUPABASE_URL:origin,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_local',VITE_FLAGS:'cloud:news,monthly-plan',VITE_VAPID_PUBLIC_KEY:''}})
if(build.status!==0)throw Error('diagnostic build failed')
const item={id:'QA-2H-NEWS-001',title:'Inflazione e risparmio: notizia sintetica QA-2H',excerpt:null,link:'https://example.invalid/qa-2h',thumb:null,published:'2026-11-01T10:00:00.000Z',lang:'it',format:'article',categories:['personal','economy'],level:'beginner',minutes:3,relevance:0.9,cluster:null,crypto:false,source:{name:'Fonte sintetica',kind:'institution',paywall:false,trust:5,country:'IT'}}
const imageHost='https://qa-covers.example.com',good=imageHost+'/synthetic.svg',bad=imageHost+'/missing.svg',redirect=imageHost+'/redirect.svg',evil='https://qa-redirect.example.net/target.svg'
const rights={images:true,rights_reference:'https://source.example.com/headline-rights',image_rights_reference:'https://source.example.com/image-licence',image_attribution:'Synthetic image author, CC BY 4.0, unchanged',image_attribution_required:true,image_hosts:['qa-covers.example.com'],image_rights_scope:'approved-urls',image_approved_urls:[good,bad,redirect]}
const variants=[item,...[[good,true,'GOOD'],[bad,true,'BAD'],[redirect,true,'REDIRECT'],[imageHost+'/unauthorized.svg',false,'DENIED']].map(([thumb,allowed,id])=>({...item,id:'QA-2I-'+id,title:'Inflazione e risparmio: copertina sintetica '+id,thumb,source:{...item.source,...rights,images:allowed}})),{...item,id:'QA-2I-NO-RIGHTS',title:'Notizia sintetica senza diritti immagine',categories:['personal'],thumb:imageHost+'/no-rights.svg',source:{...item.source,rights_reference:'https://source.example.com/headline-rights',images:false}}]
const server=await startFakeAlpha({port:4196,fixtures:{v1:out},news:true,newsItems:variants})
let c;const requests=[],externalImageAttempts=[],isExternal=url=>{const u=new URL(url);return (u.protocol==='https:'||u.protocol==='http:')&&u.origin!==origin};const until=async(f,n=160)=>{for(let i=0;i<n;i++){if(await f())return;await sleep(150)}throw Error('condition timeout')}
const stableLayout=async selector=>{const ok=await c.js(`(async()=>{const selector=${JSON.stringify(selector)};let previous='',stable=0;for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const el=document.querySelector(selector);if(!el||!el.isConnected||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden'){previous='';stable=0;continue}const r=el.getBoundingClientRect(),box=[r.left,r.right,r.top,r.bottom,r.width,r.height,el.clientWidth,el.clientHeight];if(!box.every(Number.isFinite)||r.width<=0||r.height<=0||el.clientWidth<=0||el.clientHeight<=0){previous='';stable=0;continue}const animations=new Set(el.getAnimations({subtree:true}));for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement)for(const a of p.getAnimations())animations.add(a);if([...animations].some(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime)&&a.currentTime<a.effect.getComputedTiming().endTime)){previous='';stable=0;continue}const current=box.map(x=>Math.round(x*100)/100).join(',');if(current===previous)stable++;else stable=0;previous=current;if(stable>=4)return true}return false})()`);if(!ok)throw Error('layout did not stabilize: '+selector)}
const validRect=r=>!!r&&['left','right','top','bottom','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0
try{
 c=await openChrome({port:9486,onEvent:async m=>{if(m.method==='Network.requestWillBeSent'){requests.push(m.params.request.url);if(m.params.type==='Image'&&isExternal(m.params.request.url))externalImageAttempts.push(m.params.request.url)}if(m.method==='Fetch.requestPaused'){const url=m.params.request.url;if(isExternal(url)){externalImageAttempts.push(url);if(url===redirect)await c.cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:302,responseHeaders:[{name:'Location',value:evil}]});else await c.cdp('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'})}else await c.cdp('Fetch.continueRequest',{requestId:m.params.requestId})}}})
 await c.cdp('Page.addScriptToEvaluateOnNewDocument',{source:"(()=>{const NativeDate=Date,FROZEN=NativeDate.parse('2026-11-01T12:00:00.000Z');class FrozenDate extends NativeDate{constructor(...args){super(...(args.length?args:[FROZEN]))}static now(){return FROZEN}}Object.setPrototypeOf(FrozenDate,NativeDate);globalThis.Date=FrozenDate})()"})
 await c.cdp('Network.enable');await c.cdp('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Image'}]});await c.cdp('Page.navigate',{url:origin+'/app/'});await until(()=>c.js("!!document.querySelector('.gate-cta')"));await stableLayout('.gate-cta')
 await c.js("localStorage.setItem('quadriamo.lang','it');localStorage.removeItem('q.newsFilter')");await c.cdp('Page.reload');await until(()=>c.js("!!document.querySelector('.gate-cta')"));await stableLayout('.gate-cta')
 await c.js("document.querySelector('.gate-cta')?.click()");await until(()=>c.js("!!document.querySelector('.inst-skip')"));await stableLayout('.inst-skip');await c.js("document.querySelector('.inst-skip')?.click()");
 await until(()=>c.js("!!document.querySelector('input[type=email]')"))
 await c.js("document.querySelector('input[type=email]').focus()");await c.cdp('Input.insertText',{text:USERS.B.email})
 await c.js("document.querySelector('form .btn.primary').click()");await until(()=>c.js("!!document.querySelector('input[type=password]')"))
 await c.js("document.querySelector('input[type=password]').focus()");await c.cdp('Input.insertText',{text:USERS.B.password})
 await c.js("document.querySelector('form .btn.primary').click()");
 await until(()=>c.js("!!document.querySelector('.onboarding')"))
 await stableLayout('.onboarding');await c.js("document.querySelector('.onboarding .btn.primary')?.click()");await until(()=>c.js("!!document.querySelector('.persona-row')"));await stableLayout('.persona-row');await c.js("document.querySelector('.persona-row')?.click()");
 for(let i=0;i<17&&!await c.js("!!document.querySelector('.tabbar')");i++){
 if(await c.js("!!document.querySelector('[data-testid=plan-opening]')")){
  await stableLayout('[data-testid=plan-opening]')
  const inputs="[...document.querySelectorAll('[data-testid=plan-opening] input[inputmode=decimal]')]"
  await c.js(inputs+"[0].focus()");await c.cdp('Input.insertText',{text:'1500'});await c.js(inputs+"[1].focus()");await c.cdp('Input.insertText',{text:'1000'});
  await c.js("document.querySelector('[data-testid=plan-opening] input[type=checkbox]').click();document.querySelector('[data-testid=plan-opening] button').click()");await c.js("new Promise(requestAnimationFrame)")
 }
 await c.js("document.querySelector('.step-nav .btn.primary')?.click()");if(!await c.js("!!document.querySelector('.tabbar')"))await stableLayout('.wizard')
 }
 const doc=server.state.heads.get(USERS.B.id)?.document
 if(!doc||doc.transactions.length||doc.settings.planVersion!==1||doc.settings.buckets.reduce((a,b)=>a+b.startingBalance,0)!==1000)throw Error('opening snapshot persisted incorrectly')
 if(await c.js("/A questo ritmo|a questo ritmo/.test(document.body.innerText)"))throw Error('pace projection in new plan')
 await until(()=>c.js("!!document.querySelector('.tabbar')"));await stableLayout('.tabbar');await c.js("location.hash='#/home'");await until(()=>c.js("!!document.querySelector('[data-testid=plan-availability]')"));await stableLayout('.plan-availability')
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
  await c.cdp('Page.reload');await until(()=>c.js("!!document.querySelector('[data-testid=plan-availability]')"));await stableLayout('.plan-availability')
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
  await c.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await c.js(`document.documentElement.dataset.theme='${theme}'`);await stableLayout('.home')
  const layout=await c.js("(()=>{const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,home:rect(document.querySelector('.home')),hero:rect(document.querySelector('.hero-amount')),availability:rect(document.querySelector('[data-testid=plan-availability]')),font:parseFloat(getComputedStyle(document.querySelector('.plan-availability-line')).fontSize),widget:rect(document.querySelector('.w-forecast')),widgetOverflow:document.querySelector('.w-forecast')?.scrollWidth>document.querySelector('.w-forecast')?.clientWidth+1}})()")
  if(!layout||![layout.home,layout.hero,layout.availability,layout.widget].every(validRect)||layout.overflow||layout.widgetOverflow||!Number.isFinite(layout.font)||layout.font<12||layout.hero.left<0||layout.hero.right>layout.width+1||layout.availability.left<0||layout.availability.right>layout.width+1)throw Error('Home responsive/theme check '+width+'/'+theme+' '+JSON.stringify(layout))
 }
 for(const [lang,label] of Object.entries(labels)){
  await c.js(`localStorage.setItem('quadriamo.lang','${lang}')`);await c.cdp('Page.reload');await until(()=>c.js(`document.body.innerText.includes('${label}')`));await stableLayout('.plan-availability')
  await c.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await stableLayout('.home')
  const layout=await c.js("({overflow:document.documentElement.scrollWidth>innerWidth+1,widgetOverflow:document.querySelector('.w-forecast')?.scrollWidth>document.querySelector('.w-forecast')?.clientWidth+1,font:parseFloat(getComputedStyle(document.querySelector('.plan-availability-line')).fontSize)})")
  if(layout.overflow||layout.widgetOverflow||layout.font<12)throw Error('Home localization check '+lang+' '+JSON.stringify(layout))
 }
 const budgetLayout=async selector=>c.js(`(()=>{const w=document.querySelector('${selector}');if(!w)return null;const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const finite=r=>!!r&&Object.values(r).every(Number.isFinite);const textRects=e=>{const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()].filter(x=>x.width&&x.height).map(x=>({left:x.left,right:x.right,top:x.top,bottom:x.bottom}))};const overlaps=(a,b)=>a.some(x=>b.some(y=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top));const wr=rect(w),rows=[...w.querySelectorAll('.plan-budget-row')].map(r=>{const dt=r.querySelector('dt'),dd=r.querySelector('dd'),a=textRects(dt),b=textRects(dd),lb=rect(dt),vb=rect(dd);return {label:dt.innerText,value:dd.innerText,labelFont:parseFloat(getComputedStyle(dt).fontSize),valueFont:parseFloat(getComputedStyle(dd).fontSize),labelBox:lb,valueBox:vb,labelRects:a,valueRects:b,sameLine:a.some(x=>b.some(y=>x.top<y.bottom&&x.bottom>y.top)),overlap:overlaps(a,b),outside:[...a,...b].some(x=>x.left<wr.left-1||x.right>wr.right+1||x.top<wr.top-1||x.bottom>wr.bottom+1),coordinatesValid:finite(lb)&&finite(vb)&&a.every(finite)&&b.every(finite)}});return {width:w.clientWidth,widget:wr,coordinatesValid:finite(wr)&&rows.every(x=>x.coordinatesValid),overflow:document.documentElement.scrollWidth>innerWidth+1||w.scrollWidth>w.clientWidth+1,rows}})()`)
 const setDisplayFixture=async({lang,currency,amount,size})=>{
  const h=server.state.heads.get(USERS.B.id),document=structuredClone(original),s=document.settings
  s.currency=currency;s.expectedIncome=amount;s.openingIncomeReceived=amount
  s.incomePlans=(s.incomePlans??[]).map(x=>({...x,amount}))
  if(size)s.homeWidgetSizes={...s.homeWidgetSizes,forecast:size}
  if(!s.incomePlans.length)throw Error('display fixture has no plan interval')
  document.transactions=[];server.state.heads.set(USERS.B.id,{revision:h.revision+1,document})
  await c.js(`localStorage.setItem('quadriamo.lang','${lang}')`);await c.cdp('Page.reload');await until(()=>c.js("document.querySelectorAll('.home-grid .w-forecast .plan-budget-row').length===4"));await stableLayout('.home-grid .w-forecast')
 }
 const viewports=[320,375,390,768,1440],themes=['light','dark']
 const displayCases=[['en','KWD',123456789.123],['it','EUR',123456789.12],['fr','JPY',123456789],['es','USD',123456789.12],['en','KWD',0]]
 await setDisplayFixture({lang:'en',currency:'KWD',amount:20});await c.cdp('Emulation.setDeviceMetricsOverride',{width:320,height:900,deviceScaleFactor:1,mobile:true});await stableLayout('.home-grid .w-forecast')
 const compactBudget=await budgetLayout('.home-grid .w-forecast')
 if(!compactBudget?.coordinatesValid||compactBudget.rows.length!==4||compactBudget.rows.some(x=>x.overlap||x.outside)||!compactBudget.rows[0].sameLine||!compactBudget.rows[2].sameLine||!compactBudget.rows[3].sameLine)throw Error('compact values were stacked despite fitting '+JSON.stringify(compactBudget))
 for(const [lang,currency,amount] of displayCases){
  await setDisplayFixture({lang,currency,amount})
  for(const theme of themes)for(const width of viewports){
   await c.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await c.js(`document.documentElement.dataset.theme='${theme}'`);await stableLayout('.home-grid .w-forecast')
   const layout=await budgetLayout('.home-grid .w-forecast'),containerWidth=layout?.width??0
   if(!layout||!layout.coordinatesValid||!Number.isFinite(containerWidth)||containerWidth<=0||layout.rows.length!==4||layout.overflow||layout.rows.some(x=>x.overlap||x.outside||x.labelFont<13||x.valueFont<13))throw Error('Budget widget text collision/clip '+lang+'/'+currency+'/'+width+'/'+theme+' '+JSON.stringify(layout))
  }
 }
 await setDisplayFixture({lang:'en',currency:'KWD',amount:123456789.123})
 const negativeSign=await c.js("(()=>{const d=document.querySelector('.home-grid .w-forecast .plan-budget-row:last-child dd'),parts=new Intl.NumberFormat('en',{style:'currency',currency:'KWD'}).formatToParts(-123456789.123),f=document.createDocumentFragment();for(const p of parts){const x=document.createElement('span');if(p.type==='currency')x.className='cur';x.textContent=p.type==='minusSign'?String.fromCharCode(0x2212):p.value;f.append(x)}d.replaceChildren(f);return d.innerText.charCodeAt(0)===0x2212})()")
 if(!negativeSign)throw Error('negative Money sign fixture was not rendered')
 for(const width of [320,390]){await c.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});await stableLayout('.home-grid .w-forecast');const layout=await budgetLayout('.home-grid .w-forecast');if(!layout?.coordinatesValid||layout.overflow||layout.rows.some(x=>x.overlap||x.outside||x.labelFont<13||x.valueFont<13))throw Error('negative Money sign clipped/overlapped '+width+' '+JSON.stringify(layout))}
 await setDisplayFixture({lang:'en',currency:'KWD',amount:123456789.123,size:'l'});await c.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await stableLayout('.home-grid .w-forecast')
 const wideBudget=await budgetLayout('.home-grid .w-forecast')
 if(!wideBudget?.coordinatesValid||wideBudget.width<=416||wideBudget.rows.length!==4||wideBudget.overflow||wideBudget.rows.some(x=>x.overlap||x.outside||x.labelFont<13||x.valueFont<13||!x.sameLine))throw Error('Budget widget wide layout '+JSON.stringify(wideBudget))
 await setDisplayFixture({lang:'en',currency:'KWD',amount:123456789.123});await c.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await stableLayout('.home-grid .w-forecast');await c.js("document.documentElement.dataset.theme='light';document.querySelector('.home-edit')?.click()");await until(()=>c.js("!!document.querySelector('.wg-preview .w-forecast')"));await stableLayout('.wg-preview .w-forecast')
 const gallery=await budgetLayout('.wg-preview .w-forecast')
 const galleryClip=await c.js("(()=>{const w=document.querySelector('.wg-preview .w-forecast'),p=w.closest('.wg-preview').getBoundingClientRect(),offenders=[];for(const e of w.querySelectorAll('.plan-budget-row dt,.plan-budget-row dd')){const r=document.createRange();r.selectNodeContents(e);for(const x of r.getClientRects())if(x.width&&x.height&&(x.left<p.left-1||x.right>p.right+1||x.top<p.top-1||x.bottom>p.bottom+1))offenders.push({text:e.innerText,rect:{left:x.left,right:x.right,top:x.top,bottom:x.bottom}})}return {preview:{left:p.left,right:p.right,top:p.top,bottom:p.bottom},count:offenders.length,first:offenders[0]??null}})()")
 if(!gallery?.coordinatesValid||gallery.rows.length!==4||gallery.overflow||galleryClip.count||gallery.rows.some(x=>x.overlap||x.outside||x.labelFont<13||x.valueFont<13))throw Error('Budget widget gallery layout '+JSON.stringify({gallery,galleryClip}))
 await c.js("localStorage.setItem('quadriamo.lang','it')");await c.cdp('Page.reload');await until(()=>c.js("document.body.innerText.includes('Disponibilità registrata')"))
 await c.js("location.hash='#/news'")
 const visible=()=>c.js("document.body.innerText.includes('notizia sintetica QA-2H')")
 await until(visible)
 if(!requests.some(u=>u.startsWith(origin+'/api/rest/news_items')))throw Error('no news gateway read')
 if(requests.some(u=>u.includes('/functions/v1/news')))throw Error('legacy news fallback used')
 await c.cdp('Page.reload');await until(visible);await stableLayout('.news2')
 if(externalImageAttempts.length)throw Error('Alpha made prohibited external image request(s): '+JSON.stringify(externalImageAttempts))
 const covers=await c.js("({images:document.querySelectorAll('.news-cover img').length,fallbacks:document.querySelectorAll('.news-cover-art').length,stories:document.querySelectorAll('.story').length,overflow:document.documentElement.scrollWidth>innerWidth+1})")
 if(covers.images!==0||covers.fallbacks<covers.stories||covers.overflow)throw Error('Alpha cover fallback/safety rendering '+JSON.stringify(covers))
 await stableLayout('.news2');await c.js("document.querySelector('.filter-btn')?.click()");await until(()=>c.js("!!document.querySelector('.news-filters-panel')"));await stableLayout('.news-filters-panel')
 await c.js("[...document.querySelectorAll('.nf-group')].flatMap(g=>[...g.querySelectorAll('button')]).find(b=>b.innerText==='Economia')?.click()");await until(()=>c.js("[...document.querySelectorAll('.nf-group button')].some(b=>b.innerText==='Economia'&&b.getAttribute('aria-pressed')==='true')"))
 await c.js("document.querySelector('.nf-actions .btn.primary')?.click()");await stableLayout('.news2')
 const filtered=await c.js("[...document.querySelectorAll('.story-title')].map(x=>x.innerText)")
 if(!filtered.length||filtered.some(x=>x.includes('senza diritti immagine')))throw Error('news topic filter did not filter sections')
 await c.js("[...document.querySelectorAll('.story')].find(x=>x.innerText.includes('GOOD')).click()");await until(()=>c.js("!!document.querySelector('.story-detail')"));await stableLayout('.story-detail')
 const detail=await c.js("({fallback:!!document.querySelector('.story-detail .news-cover-art'),img:!!document.querySelector('.story-detail img.story-hero'),imageCredit:!!document.querySelector('.news-credit'),titleRights:[...document.querySelectorAll('.story-detail a')].some(a=>a.href.includes('headline-rights')),text:document.querySelector('.story-detail')?.innerText})")
 if(!detail.fallback||detail.img||detail.imageCredit||!detail.titleRights||detail.text.includes('Synthetic image author'))throw Error('news fallback attribution does not match displayed content '+JSON.stringify(detail))
 await c.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});await c.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape'});await until(()=>c.js("!document.querySelector('.story-detail')"))
 await c.js("localStorage.removeItem('q.newsFilter');location.reload()");await until(visible);await stableLayout('.news2')
 const allStories=await c.js("document.querySelectorAll('.story').length")
 if(allStories<covers.stories)throw Error('news reload/filter reset lost synthetic stories')
 if(externalImageAttempts.length)throw Error('external cover/redirect was requested: '+JSON.stringify(externalImageAttempts))
 console.log(JSON.stringify({classification:'SIMULATED',passed:['complete planned onboarding -> snapshot without fictitious income -> CAS persistence','B target stable across balances, future income, tranches and extras; shortfall alert positive/negative; 320/375/390/768/1440 light/dark; IT/EN/FR/ES','Budget widget browser bounds/no overlap/no clipping for EUR/USD/JPY/KWD and zero/large values; narrow Home/gallery containers','authenticated Alpha frontend -> news gateway -> synthetic backend','month budget widget has one heading and four aligned facts','news filter, sections, detail, reload and fallback for good/missing/redirect/denied/no-rights covers','no image element, image credit for fallback, external request or redirect; title-rights attribution retained','no legacy Edge Function call'],cloudWrites:0,realAccounts:0,externalImageAttempts}))
}catch(e){console.log('Diagnostic UI:',(await c?.js('document.body.innerText'))?.slice(0,800));throw e}finally{await c?.close();await server.close()}
