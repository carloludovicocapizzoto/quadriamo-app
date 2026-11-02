import {afterAll,beforeAll,expect,it} from 'vitest'
import {createServer,type Server} from 'node:http'
import {prepareImage,type ImageTransport} from '../supabase/functions/_shared/alpha-news-image'
let server:Server,origin:string,hits=0
const base='https://images.example.com'
const rights={images:true,image_rights_reference:'https://source.example.com/licence',image_attribution:'Synthetic',image_hosts:['images.example.com'],image_rights_scope:'feed'}
beforeAll(async()=>{
 server=createServer((req,res)=>{hits++;const path=req.url
  if(path==='/same'||path==='/chain'){res.writeHead(302,{location:path==='/chain'?'/same':'/valid'});res.end();return}
  if(path==='/external'){res.writeHead(302,{location:'https://unapproved.example.invalid/no'});res.end();return}
  if(path==='/error'){req.socket.destroy();return}
  res.setHeader('content-type',path==='/html'?'text/html':'image/png')
  res.end(path==='/large'?Buffer.alloc(256*1024+1):path==='/html'||path==='/fake'?'synthetic':Buffer.from([137,80,78,71,13,10,26,10]))
 });await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`
})
afterAll(()=>new Promise<void>(r=>server.close(()=>r())))
// Synthetic-only adapter: maps approved DNS to the loopback test server. NEVER used by app.
const transport:ImageTransport={fetchPinned:async(url,options)=>{const r=await fetch(origin+new URL(url).pathname,options);return new Response(r.body,{status:r.status,headers:r.headers})}}
it('accepts a bounded synthetic raster, never redirects (even same host), and fails closed',async()=>{
 expect((await prepareImage(base+'/valid',rights,transport))?.type).toBe('image/png')
 for(const path of ['/same','/external','/chain','/html','/fake','/error','/large'])expect(await prepareImage(base+path,rights,transport)).toBeNull()
 const before=hits
 for(const [url,r] of [[base+'/valid',{...rights,images:false}],['https://unapproved.example.com/x',rights]] as const)expect(await prepareImage(url,r,transport)).toBeNull()
 expect(hits).toBe(before)
})
