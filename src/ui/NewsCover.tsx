import { useState } from 'react'
import { ENV } from '../env'
import type { HubItem } from '../news/hub'
import { approvedImage } from '../../supabase/functions/_shared/alpha-news-policy'

export function NewsCover({ item, className }: { item: HubItem; className: string }) {
 const src=ENV.name==='alpha'?approvedImage(item.thumb,item.source):item.thumb
 const [failed,setFailed]=useState<string|null>(null)
 if(ENV.name!=='alpha')return src&&failed!==src?<img className={className} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:null
 return <span className={className+' news-cover'} aria-hidden="true">{src&&failed!==src?
  <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<span className="news-cover-art">▤</span>}</span>
}
