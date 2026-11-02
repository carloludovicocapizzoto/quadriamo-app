// Offline only: validates an explicitly approved manifest and emits inactive seed/config.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {approvedImage,publicHttps} from '../../supabase/functions/_shared/alpha-news-policy.ts'
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('usage: node tools/news/prepare-alpha.mjs manifest.json output-directory')
const m=JSON.parse(readFileSync(input,'utf8'));if(!Array.isArray(m.sources))throw Error('sources array required')
const ids=new Set(),hosts=new Set(),rows=[];const q=s=>"'"+String(s).replaceAll("'","''")+"'"
for(const x of m.sources){
 const feed=publicHttps(x.feed),site=publicHttps(x.site)
 if(!/^[a-z0-9-]{1,64}$/.test(x.id)||ids.has(x.id)||!feed||!site||!['it','en','fr','es'].includes(x.lang)||!['press','independent','research','institution','video','podcast'].includes(x.kind)||!Number.isInteger(x.trust)||x.trust<1||x.trust>5||!x.name?.trim()||x.name.length>120||x.feed.length>2048||x.site.length>2048||!m.approvedBy?.trim()||x.rights?.titleAllowed!==true||!x.rights?.reference?.trim()||!(x.linkPrefixes??[]).every(p=>typeof p==='string'&&/^\/[\w\-./]*$/.test(p)&&p.length<=200))throw Error('approved source contract invalid: '+(x.id??'unnamed'))
 const im=x.imageRights??{},enabled=im.allowed===true
 const rights={images:enabled,image_rights_reference:im.reference,image_attribution:im.attribution,image_attribution_required:im.attributionRequired!==false,image_hosts:im.hosts??[],image_rights_scope:im.scope??'none',image_approved_urls:im.approvedUrls??[]}
 if(enabled){const samples=rights.image_rights_scope==='feed'?rights.image_hosts.map(h=>'https://'+h+'/permission-check'):rights.image_approved_urls;if(!samples.length||samples.some(u=>!approvedImage(u,rights)))throw Error('approved image contract invalid: '+x.id)}
 const arr=a=>'ARRAY['+a.map(q).join(',')+']::text[]'
 ids.add(x.id);hosts.add(feed.hostname);hosts.add(site.hostname)
 rows.push('('+[x.id,x.name,x.kind,'rss',feed.href,site.href,x.lang].map(q).join(',')+','+x.trust+',false,'+enabled+','+q(x.rights.reference)+','+q(m.approvedBy)+','+[q(im.reference??''),q(im.attribution??''),String(rights.image_attribution_required),arr(rights.image_hosts),q(rights.image_rights_scope),arr(rights.image_approved_urls),arr(x.linkPrefixes??[])].join(',')+')')
}
const dir=resolve(output);mkdirSync(dir,{recursive:true})
writeFileSync(join(dir,'seed-inactive.sql'),'-- Prepared offline; review before any authorized Alpha execution. All sources remain inactive.\nbegin;\n'+(rows.length?'insert into public.news_sources(id,name,kind,format,feed,site,lang,trust,active,images,rights_reference,approved_by,image_rights_reference,image_attribution,image_attribution_required,image_hosts,image_rights_scope,image_approved_urls,link_prefixes) values\n'+rows.join(',\n')+' on conflict(id) do nothing;\n':'-- No approved sources provided.\n')+'commit;\n')
writeFileSync(join(dir,'config.json'),JSON.stringify({ALPHA_NEWS_ENABLED:'0',ALPHA_NEWS_INGEST_ENABLED:'0',NEWS_ALLOWED_HOSTS:[...hosts].sort().join(','),requiredSecretNames:['CRON_SECRET','SUPABASE_SERVICE_ROLE_KEY'],sources:rows.length},null,2)+'\n')
console.log(JSON.stringify({sources:rows.length,active:0,output:dir}))
