import { useState } from 'react'
import { ENV } from '../env'
import type { HubItem } from '../news/hub'

export function NewsCover({ item, className }: { item: HubItem; className: string }) {
 // External Alpha images stay disabled until controlled, redirect-safe delivery is
 // deployed. Rights metadata alone cannot constrain redirects followed by <img>.
 const src=ENV.name==='alpha'?null:item.thumb
 const [failed,setFailed]=useState<string|null>(null)
 if(ENV.name!=='alpha')return src&&failed!==src?<img className={className} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:null
 return <span className={className+' news-cover'} aria-hidden="true">{src&&failed!==src?
  <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<span className="news-cover-art">▤</span>}</span>
}
