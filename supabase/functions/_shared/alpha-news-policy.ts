/** Strict configured public DNS host allowlist. No IP literals, local names, redirects or URL credentials. */
export function publicHttps(raw:string):URL|null {
 try {const u=new URL(raw),h=u.hostname.toLowerCase();if([...u.searchParams.keys()].some(k=>/token|secret|password|api[_-]?key|signature|authorization/i.test(k)))return null;if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!h.includes('.')||/[\[\]:]/.test(h)||/^[\d.]+$/.test(h)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(h))return null;return u}catch{return null}
}
export function approvedUrl(raw:string,hosts:string[]):boolean {const u=publicHttps(raw);return !!u&&hosts.includes(u.hostname)}
export function validFeedXml(xml:string):boolean {return !/<!DOCTYPE|<!ENTITY/i.test(xml)&&/<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(xml)}

export interface ImageRights {
 images?: boolean; image_rights_reference?: string | null; image_attribution?: string | null
 image_attribution_required?: boolean; image_hosts?: string[]; image_rights_scope?: string
 image_approved_urls?: string[]
}
/** A public feed or OG tag is not an image licence. No requests are made here. */
export function approvedImage(raw:string|null|undefined,source:ImageRights):string|null {
 if(typeof raw!=='string'||!raw||raw.length>2048||!source||source.images!==true||typeof source.image_rights_reference!=='string'||!publicHttps(source.image_rights_reference)||!Array.isArray(source.image_hosts)||!approvedUrl(raw,source.image_hosts))return null
 if(source.image_attribution_required!==false&&(typeof source.image_attribution!=='string'||!source.image_attribution.trim()))return null
 if(source.image_rights_scope!=='feed'&&!(source.image_rights_scope==='approved-urls'&&Array.isArray(source.image_approved_urls)&&source.image_approved_urls.includes(raw)))return null
 return raw
}
