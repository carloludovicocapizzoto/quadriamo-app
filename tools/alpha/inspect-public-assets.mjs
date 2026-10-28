// Bounded inspection of public static assets only. Reports marker counts, never matched values.
const origin='https://quadriamo-alpha.pages.dev'
const html=await (await fetch(origin+'/app/',{signal:AbortSignal.timeout(15000)})).text()
const queue=[...html.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)].map(m=>new URL(m[1],origin+'/app/').href)
const seen=new Set(),hosts=new Set();let bytes=0,markers=0
while(queue.length){
  const url=new URL(queue.shift())
  if(seen.has(url.href))continue
  if(url.origin!==origin || !url.pathname.startsWith('/assets/') || !url.pathname.endsWith('.js'))throw Error('unexpected asset origin or path')
  if(seen.size>=50)throw Error('asset count budget exceeded')
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'})
  if(!response.ok)throw Error('asset unavailable')
  const text=await response.text();bytes+=Buffer.byteLength(text)
  if(bytes>5*1024*1024)throw Error('asset bytes budget exceeded')
  seen.add(url.href)
  for(const re of [/sb_secret_[A-Za-z0-9_-]{16,}/g,/ghp_[A-Za-z0-9]{20,}/g,/BEGIN (?:RSA |EC )?PRIVATE KEY/g,/ALPHA_GATEWAY_KEY_HEX/g])markers += [...text.matchAll(re)].length
  for(const m of text.matchAll(/https:\/\/([a-z0-9]+\.supabase\.co)/g))hosts.add(m[1])
  for(const m of text.matchAll(/["']((?:\.\/|\/?assets\/)[^"']+\.js)["']/g))
    queue.push(new URL(m[1].startsWith('assets/')?'/'+m[1]:m[1],url).href)
}
const hostsValid=hosts.size===1&&hosts.has('djkoxecmobafenfazcum.supabase.co')
console.log(JSON.stringify({assets:seen.size,bytes,privateMarkers:markers,supabaseHosts:[...hosts],result:markers===0&&hostsValid?'PASS':'FAIL'}))
process.exitCode=markers===0&&hostsValid?0:1
