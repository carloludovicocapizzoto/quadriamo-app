// Read-only Alpha probes. No credentials accepted; JWTs below are intentionally invalid.
const ORIGIN='https://quadriamo-alpha.pages.dev'
const SYNTHETIC='11111111-1111-4111-8111-111111111111'
const invalidJwt=exp=>`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:SYNTHETIC,role:'authenticated',exp,iss:'https://djkoxecmobafenfazcum.supabase.co/auth/v1'})).toString('base64url')}.invalid-signature`
const cases=[
  ['home',ORIGIN+'/',{method:'GET'},200],
  ['app',ORIGIN+'/app/',{method:'GET'},200],
  ['no-jwt',ORIGIN+'/api/rest/rpc/qsync_read',{method:'POST',body:'{}'},401],
  ['malformed-jwt',ORIGIN+'/api/rest/rpc/qsync_read',{method:'POST',headers:{authorization:'Bearer malformed'},body:'{}'},401],
  ['expired-forged-jwt',ORIGIN+'/api/rest/rpc/qsync_read',{method:'POST',headers:{authorization:'Bearer '+invalidJwt(1)},body:'{}'},401],
  ['future-forged-jwt',ORIGIN+'/api/rest/rpc/qsync_read',{method:'POST',headers:{authorization:'Bearer '+invalidJwt(Math.floor(Date.now()/1000)+3600)},body:'{}'},401],
  ['admin-route',ORIGIN+'/api/rest/rpc/admin_users',{method:'POST',body:'{}'},404],
  ['direct-data-api-no-auth','https://djkoxecmobafenfazcum.supabase.co/rest/v1/',{method:'GET'},401],
]
let failed=false
for(const [name,url,init,expected] of cases){
  try {const r=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)})
    await r.body?.cancel();const pass=r.status===expected;failed ||= !pass
    console.log(JSON.stringify({probe:name,status:r.status,expected,result:pass?'PASS':'FAIL'}))
  }catch{failed=true;console.log(JSON.stringify({probe:name,result:'BLOCKED',reason:'network or redirect'}))}
}
process.exitCode=failed?1:0
