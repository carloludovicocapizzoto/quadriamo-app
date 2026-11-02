import {expect,it} from 'vitest'
import {approvedUrl,validFeedXml} from '../supabase/functions/_shared/alpha-news-policy'
it('source allowlisting rejects local/IP/credentials/ports, unsafe XML and foreign article links',()=>{
 for(const u of ['https://example.com/rss?api_key=synthetic','http://example.com/rss','https://127.0.0.1/rss','https://169.254.169.254/','https://[::1]/','https://metadata.internal/','https://local/','https://u:p@example.com/','https://example.com:444/'])expect(approvedUrl(u,[new URL(u).hostname])).toBe(false)
 expect(approvedUrl('https://feed.example.com/rss',['feed.example.com'])).toBe(true)
 expect(approvedUrl('https://evil.example.com/article',['feed.example.com'])).toBe(false)
 expect(validFeedXml('<rss><channel/></rss>')).toBe(true);expect(validFeedXml('<html>error</html>')).toBe(false);expect(validFeedXml('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]><rss/>')).toBe(false)
})
