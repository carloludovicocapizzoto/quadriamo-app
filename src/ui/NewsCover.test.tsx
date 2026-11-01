import {expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import type {HubItem} from '../news/hub'
vi.mock('../env',()=>({ENV:{name:'alpha'}}))
import {ENV} from '../env'
import {NewsCover} from './NewsCover'
const thumb='https://images.example.com/synthetic.svg',source={name:'Synthetic',kind:'institution',paywall:false,trust:4,images:true,image_rights_reference:'https://source.example.com/rights',image_attribution:'Synthetic author',image_hosts:['images.example.com'],image_rights_scope:'approved-urls',image_approved_urls:[thumb]}
const render=(img:string|null,rights=source)=>renderToStaticMarkup(<NewsCover item={{thumb:img,source:rights} as HubItem} className="story-thumb"/> )
it('Alpha renders a cover only with independent image rights, otherwise preserves the card with a local fallback',()=>{
 expect(render(thumb)).toContain('<img');expect(render(thumb)).toContain('no-referrer')
 for(const html of [render(null),render('http://bad.example.com/x'),render(thumb,{...source,images:false}),render(thumb,{...source,image_attribution:''})]){expect(html).not.toContain('<img');expect(html).toContain('news-cover-art');expect(html).toContain('story-thumb')}
})

it('historical build keeps its original image markup without requiring Alpha schema',()=>{ENV.name='production';try{expect(render(thumb,{...source,images:false})).toContain('<img class="story-thumb"');expect(render(null)).toBe('')}finally{ENV.name='alpha'}})
