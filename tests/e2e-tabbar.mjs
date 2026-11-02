import { randomUUID } from 'node:crypto'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const { openChrome, sleep } = await import(pathToFileURL(resolve(root, 'tools/chrome.mjs')))
const { startFakeAlpha, USERS } = await import(pathToFileURL(resolve(root, 'tests/fake-alpha.mjs')))
const build = (name, port, flags) => {
  const out = join(tmpdir(), `quadriamo-tabbar-${randomUUID()}-${name}`)
  const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'alpha', '--outDir', out, '--logLevel', 'error'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, BASE_PATH: '/', VITE_SUPABASE_URL: `http://127.0.0.1:${port}`, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_local', VITE_FLAGS: flags, VITE_VAPID_PUBLIC_KEY: '' },
  })
  if (r.status !== 0) throw Error(`${name} diagnostic build failed`)
  return out
}
const offOut = build('news-off', 4197, '')
const onOut = build('news-on', 4198, 'cloud:news')
const offServer = await startFakeAlpha({ port: 4197, fixtures: { v1: offOut } })
const onServer = await startFakeAlpha({ port: 4198, fixtures: { v1: onOut }, news: true, newsItems: [{ id: 'QA-TAB-001', title: 'Notizia sintetica tabbar', link: 'https://example.invalid/qa-tab', published: new Date().toISOString(), lang: 'it', format: 'article', categories: ['personal'], level: 'beginner', minutes: 2, source: { name: 'Fonte sintetica', kind: 'institution', paywall: false, trust: 5, country: 'IT' } }] })
const langs = {
  it: { home: 'Home', news: 'Notizie', add: 'Aggiungi', analysis: 'Analisi', profile: 'Profilo' },
  en: { home: 'Home', news: 'News', add: 'Add', analysis: 'Insights', profile: 'Profile' },
  fr: { home: 'Accueil', news: 'Actus', add: 'Ajouter', analysis: 'Analyse', profile: 'Profil' },
  es: { home: 'Inicio', news: 'Noticias', add: 'Añadir', analysis: 'Análisis', profile: 'Perfil' },
}
let c
let requests = []
const until = async (fn, count = 120) => { for (let i = 0; i < count; i++) { if (await fn()) return; await sleep(100) } throw Error('condition timeout') }
const stableLayout = async selector => {
  const ok = await c.js(`(async()=>{const selector=${JSON.stringify(selector)};let prev='',stable=0;for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const el=document.querySelector(selector);if(!el||!el.isConnected||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden'){prev='';stable=0;continue}const r=el.getBoundingClientRect(),v=[r.left,r.right,r.top,r.bottom,r.width,r.height,el.clientWidth,el.clientHeight];if(!v.every(Number.isFinite)||r.width<=0||r.height<=0||el.clientWidth<=0||el.clientHeight<=0){prev='';stable=0;continue}const a=new Set(el.getAnimations({subtree:true}));for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement)for(const x of p.getAnimations())a.add(x);if([...a].some(x=>x.playState==='running'&&Number.isFinite(x.effect?.getComputedTiming().endTime)&&x.currentTime<x.effect.getComputedTiming().endTime)){prev='';stable=0;continue}const cur=v.map(x=>Math.round(x*100)/100).join(',');if(cur===prev)stable++;else stable=0;prev=cur;if(stable>=4)return true}return false})()`)
  if (!ok) throw Error(`tabbar layout did not stabilize: ${selector}`)
}
const inspect = async () => c.js(`(()=>{const n=document.querySelector('.tabbar'),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}},valid=r=>Object.values(r).every(Number.isFinite),nav=rect(n),buttons=[...n.querySelectorAll(':scope > button')].map(b=>{const br=rect(b),l=b.querySelector('.nav-label'),lr=rect(l),range=document.createRange();range.selectNodeContents(l);const texts=[...range.getClientRects()].filter(x=>x.width&&x.height).map(x=>({left:x.left,right:x.right,top:x.top,bottom:x.bottom}));return {label:l.innerText.trim(),button:br,labelBox:lr,texts,visible:!!b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden',font:parseFloat(getComputedStyle(l).fontSize),valid:valid(br)&&valid(lr)&&texts.every(x=>Object.values(x).every(Number.isFinite)),current:b.getAttribute('aria-current')==='page',focused:b.matches(':focus-visible')}});return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,nav,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,buttons}})()`)
const startSyntheticUser = async server => {
  c = await openChrome({ port: 9491, onEvent: async m => { if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url) } })
  await c.cdp('Network.enable')
  await c.cdp('Page.navigate', { url: server.origin + '/app/' })
  await until(() => c.js("!!document.querySelector('.gate-cta')")); await stableLayout('.gate-cta')
  await c.js("localStorage.setItem('quadriamo.lang','it')")
  await c.cdp('Page.reload'); await until(() => c.js("!!document.querySelector('.gate-cta')")); await stableLayout('.gate-cta')
  await c.js("document.querySelector('.gate-cta').click()")
  await until(() => c.js("!!document.querySelector('.inst-skip')")); await stableLayout('.inst-skip')
  await c.js("document.querySelector('.inst-skip').click()")
  await until(() => c.js("!!document.querySelector('input[type=email]')"))
  await c.js("document.querySelector('input[type=email]').focus()"); await c.cdp('Input.insertText', { text: USERS.B.email })
  await c.js("document.querySelector('form .btn.primary').click()")
  await until(() => c.js("!!document.querySelector('input[type=password]')"))
  await c.js("document.querySelector('input[type=password]').focus()"); await c.cdp('Input.insertText', { text: USERS.B.password })
  await c.js("document.querySelector('form .btn.primary').click()")
  await until(() => c.js("!!document.querySelector('.onboarding')")); await stableLayout('.onboarding')
  await c.js("document.querySelector('.onboarding .btn.primary').click()")
  await until(() => c.js("!!document.querySelector('.persona-row')")); await stableLayout('.persona-row')
  await c.js("document.querySelector('.persona-row').click()")
  await until(() => c.js("!!document.querySelector('.wizard .step-nav .link-btn')")); await stableLayout('.wizard')
  await c.js("document.querySelector('.wizard .step-nav .link-btn').click()")
  await until(() => c.js("!!document.querySelector('.tabbar')")); await stableLayout('.tabbar')
  if (await c.js("document.body.innerText.includes('Obiettivo giornaliero pianificato')")) throw Error('monthly-plan unexpectedly enabled in tabbar build')
}
const runMode = async (server, hasNews) => {
  requests = []
  await startSyntheticUser(server)
  const expected = 5
  const matrix = []
  for (const [lang, labels] of Object.entries(langs)) {
    if (lang !== 'it') {
      await c.js(`localStorage.setItem('quadriamo.lang',${JSON.stringify(lang)})`)
      await c.cdp('Page.reload'); await until(() => c.js("!!document.querySelector('.tabbar')")); await stableLayout('.tabbar')
    }
    for (const theme of ['light', 'dark']) for (const width of [320, 375, 390, 768]) {
      await c.cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 })
      await c.js(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`); await stableLayout('.tabbar')
      const m = await inspect()
      if (!m || !m.nav || !Object.values(m.nav).every(Number.isFinite) || m.buttons.length !== expected || m.scrollWidth > m.clientWidth + 1 || m.documentWidth > width + 1) throw Error(`tabbar width/count ${hasNews}/${lang}/${theme}/${width}: ${JSON.stringify(m)}`)
      if (m.buttons.some((b, i) => !b.visible || !b.valid || b.button.width < 44 || b.button.height < 44 || b.font < 10 || b.button.left < m.nav.left - 1 || b.button.right > m.nav.right + 1 || b.labelBox.left < b.button.left - 1 || b.labelBox.right > b.button.right + 1 || b.texts.some(x => x.left < b.button.left - 1 || x.right > b.button.right + 1) || (i > 0 && b.button.left < m.buttons[i - 1].button.right - 1))) throw Error(`tabbar clipping/touch target ${hasNews}/${lang}/${theme}/${width}: ${JSON.stringify(m)}`)
      const visibleLabels = m.buttons.map(b => b.label)
      const wantedLabels = [labels.home, labels.news, labels.add, labels.analysis, labels.profile]
      if (JSON.stringify(visibleLabels) !== JSON.stringify(wantedLabels)) throw Error(`tab order/localization ${lang}: ${JSON.stringify(visibleLabels)} expected ${JSON.stringify(wantedLabels)}`)
      matrix.push({ lang, theme, width, count: m.buttons.length, tabbar: Math.round(m.nav.width), buttonMin: Math.floor(Math.min(...m.buttons.map(b => b.button.width))) })
    }
  }
  await c.js("localStorage.setItem('quadriamo.lang','it');document.documentElement.dataset.theme='light'"); await c.cdp('Page.reload'); await until(() => c.js("!!document.querySelector('.tabbar')")); await stableLayout('.tabbar')
  await c.cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true }); await stableLayout('.tabbar')
  const nontabs = 4
  for (let i = 0; i < nontabs; i++) {
    await c.js(`document.querySelectorAll('.tabbar > button:not(.tab-add)')[${i}].click()`)
    await until(() => c.js(`document.querySelectorAll('.tabbar > button:not(.tab-add)')[${i}]?.getAttribute('aria-current')==='page'`)); await stableLayout('.tabbar')
    const hash = await c.js('location.hash')
    const wanted = ['#/', '#/news', '#/analysis/month', '#/profile'][i]
    if (hash !== wanted && !(wanted === '#/' && hash === '')) throw Error(`tab ${i} did not navigate: ${hash} expected ${wanted}`)
    if (i === 1 && !hasNews) {
      await until(() => c.js("!!document.querySelector('.news2 .news-section .faq li details summary')"))
      const tips = await c.js("({visible:!!document.querySelector('.news2 .news-section .faq li details summary'),text:document.querySelector('.news2')?.innerText||''})")
      if (!tips.visible) throw Error('News OFF did not render local tips')
      const feedRequests = requests.filter(url => url.includes('/api/rest/news_items') || url.includes('/functions/v1/news'))
      if (feedRequests.length) throw Error(`News OFF called the disabled cloud feed: ${JSON.stringify(feedRequests)}`)
    }
  }
  await c.js("document.querySelector('.tab-add').click()")
  await until(() => c.js("!!document.querySelector('#tx-title')")); await stableLayout('#tx-title')
  await c.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' }); await c.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' })
  await until(() => c.js("!document.querySelector('#tx-title')"))
  await c.js("document.querySelector('.tabbar > button:not(.tab-add)').focus()")
  await c.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await c.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  const focus = await c.js("(()=>{const e=document.activeElement,s=getComputedStyle(e);return {inside:!!e.closest('.tabbar'),visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()")
  if (!focus.inside || !focus.visible || focus.outline === 'none' || focus.width < 2) throw Error(`tab keyboard focus invisible: ${JSON.stringify(focus)}`)
  const result = { mode: hasNews ? 'News ON, simulated' : 'News OFF, Alpha default', matrix }
  await c.close(); c = null
  return result
}
try {
  const results = [await runMode(offServer, false), await runMode(onServer, true)]
  console.log(JSON.stringify({ classification: 'LOCAL/SIMULATED', results, realAccounts: 0, cloudWrites: 0 }))
} finally {
  if (c) await c.close()
  await offServer.close(); await onServer.close()
}
