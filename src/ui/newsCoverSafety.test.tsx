import {expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {NewsCover} from './NewsCover'
import type {HubItem} from '../news/hub'
vi.mock('../env',()=>({ENV:{name:'alpha'}}))
it('Alpha cannot request any external image even with approved rights until safe delivery is activated',()=>{
 const thumb='https://images.example.com/licensed.png'
 const item={thumb,source:{images:true,image_rights_reference:'https://source.example.com/licence',image_attribution:'Synthetic',image_hosts:['images.example.com'],image_rights_scope:'feed'}} as HubItem
 const html=renderToStaticMarkup(<NewsCover item={item} className="cover"/> )
 expect(html).not.toContain('<img');expect(html).toContain('news-cover-art')
})
