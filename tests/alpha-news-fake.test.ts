import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect,it } from 'vitest'
// @ts-expect-error JS test server
import { startFakeAlpha } from './fake-alpha.mjs'
it('SIMULATED news uses authenticated reads and denies writes; no network data source',async()=>{
 const root=mkdtempSync(join(tmpdir(),'quadriamo-news-'))
 const item={id:'QA-2H-NEWS',title:'Synthetic fixture'}
 const s=await startFakeAlpha({port:0,fixtures:{v1:root},news:true,newsItems:[item]})
 const origin='http://127.0.0.1:'+s.address.port
 try{
  expect((await fetch(origin+'/api/rest/news_items')).status).toBe(401)
  const login=await fetch(origin+'/__e2e/invite',{method:'POST',headers:{'x-e2e-token':s.controlToken},body:JSON.stringify({user:'B'})});const session=await login.json()
  const headers={authorization:'Bearer '+session.access_token}
  const res=await fetch(origin+'/api/rest/news_items',{headers});expect(res.status).toBe(200);expect(await res.json()).toEqual([item])
  expect((await fetch(origin+'/api/rest/news_items',{method:'POST',headers,body:'{}'})).status).toBe(404)
 }finally{await s.close();rmSync(root,{recursive:true,force:true})}
})
