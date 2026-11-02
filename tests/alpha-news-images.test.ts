import {expect,it} from 'vitest'
import {approvedImage} from '../supabase/functions/_shared/alpha-news-policy'
const url='https://images.example.com/synthetic.svg',rights={images:true,image_rights_reference:'https://source.example.com/licence',image_attribution:'Synthetic author — CC BY 4.0, unchanged',image_attribution_required:true,image_hosts:['images.example.com'],image_rights_scope:'approved-urls',image_approved_urls:[url]}
it('image rights are explicit, independent and fail closed for cached or malformed metadata',()=>{
 expect(approvedImage(url,rights)).toBe(url)
 for(const r of [{},{...rights,images:false},{...rights,image_rights_reference:''},{...rights,image_attribution:''},{...rights,image_hosts:[]},{...rights,image_rights_scope:'none'},{...rights,image_approved_urls:[]}])expect(approvedImage(url,r)).toBeNull()
 for(const u of [null,'','http://images.example.com/x','https://evil.example.com/x','https://images.example.com/other','https://images.example.com/synthetic.svg?token=private','data:image/svg+xml,test'])expect(approvedImage(u,rights)).toBeNull()
 expect(approvedImage('https://images.example.com/other',{...rights,image_rights_scope:'feed'})).not.toBeNull()
})
