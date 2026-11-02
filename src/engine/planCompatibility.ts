/** Capability detection also covers partial/restored documents, independently of validation.
 * planVersion governs snapshot accounting; it must not be invented for legacy archives.
 */
export function needsPlanClient(document: unknown): boolean {
 if (!document || typeof document !== 'object') return false
 const s=(document as {settings?:Record<string,unknown>}).settings
 if (!s || typeof s !== 'object') return false
 const owns=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k)
 if (['planVersion','balanceDate','incomePlans','expectedIncome','expectedFrom','openingIncomeReceived'].some(k=>owns(s,k))) return true
 return Array.isArray(s.events)&&s.events.some(e=>e&&typeof e==='object'&&['planExclusions','planOffFrom'].some(k=>owns(e,k)))
}
