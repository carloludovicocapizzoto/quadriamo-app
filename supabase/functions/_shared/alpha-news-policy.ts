/** Strict configured public DNS host allowlist. No IP literals, local names, redirects or URL credentials. */
export function publicHttps(raw:string):URL|null {
 try {const u=new URL(raw),h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!h.includes('.')||/[\[\]:]/.test(h)||/^[\d.]+$/.test(h)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(h))return null;return u}catch{return null}
}
export function approvedUrl(raw:string,hosts:string[]):boolean {const u=publicHttps(raw);return !!u&&hosts.includes(u.hostname)}
export function validFeedXml(xml:string):boolean {return !/<!DOCTYPE|<!ENTITY/i.test(xml)&&/<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(xml)}
