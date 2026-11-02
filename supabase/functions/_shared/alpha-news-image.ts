import {approvedImage, type ImageRights} from './alpha-news-policy'

/** No default transport or public endpoint: Alpha covers remain OFF.
 * A future server adapter must resolve ONLY public addresses, pin the connection to
 * that validated address (including TLS hostname verification), and never redirect.
 * Native fetch alone is NOT a valid production adapter (DNS rebinding).
 */
export interface ImageTransport {
 fetchPinned(url:string,options:{redirect:'error';signal:AbortSignal}):Promise<Response>
}
export async function prepareImage(raw:string,rights:ImageRights,transport:ImageTransport):Promise<{bytes:Uint8Array;type:string}|null> {
 if(!approvedImage(raw,rights))return null
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),5000),limit=256*1024
 try {
  const response=await transport.fetchPinned(raw,{redirect:'error',signal:abort.signal})
  if(!response.ok||response.redirected||(response.url&&response.url!==raw))return null
  const type=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase()
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(type)||Number(response.headers.get('content-length'))>limit)return null
  const reader=response.body?.getReader();if(!reader)return null
  const chunks:Uint8Array[]=[];let size=0
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)return null;chunks.push(value)}}finally{await reader.cancel()}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
  const prefix=(xs:number[])=>xs.every((x,i)=>bytes[i]===x)
  const text=(from:number,n:number)=>String.fromCharCode(...bytes.slice(from,from+n))
  if(!(type==='image/png'&&prefix([137,80,78,71,13,10,26,10])||type==='image/jpeg'&&prefix([255,216,255])||type==='image/gif'&&['GIF87a','GIF89a'].includes(text(0,6))||type==='image/webp'&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'))return null
  return {bytes,type}
 }catch{return null}finally{abort.abort();clearTimeout(timer)}
}
