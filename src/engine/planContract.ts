import { isIsoDate, monthOf, nextMonth, ymKey } from './dates'
import type { Settings } from './types'
import type { CalEvent } from './calendar'
export interface PlanInterval { from: string; until: string | null }
export interface IncomePlan { from: string; amount: number }
/** Only the exact old onboarding signature means salary already in snapshot.
 * A single explicit zero budget written from Settings must remain zero.
 */
export function legacyOpeningIncome(s:Settings):number {
 const xs=s.incomePlans,n=s.expectedIncome??0
 return s.planVersion===1&&s.openingIncomeReceived==null&&n>0&&xs?.[0]?.from===ymKey(s.firstMonth)&&xs[0].amount===0&&xs[1]?.from===ymKey(nextMonth(s.firstMonth))&&xs[1].amount===n?n:0
}
export const isPlanMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
export function intervalsValid(xs: PlanInterval[]) {
 return Array.isArray(xs) && xs.every((x,i)=>x && isIsoDate(x.from) && (x.until===null || (isIsoDate(x.until)&&x.until>=x.from)) && (!i || (xs[i-1].until!==null && xs[i-1].until!<=x.from)))
}
export function countsInPlan(e: Pick<CalEvent,'planExclusions'|'planOffFrom'>, date: string) {
 const legacy=typeof e.planOffFrom==='string'&&isIsoDate(e.planOffFrom)?e.planOffFrom:null
 const xs=Array.isArray(e.planExclusions)?e.planExclusions:[]
 return !(legacy && date>=legacy) && !xs.some(x=>x&&isIsoDate(x.from)&&(x.until===null||(isIsoDate(x.until)&&x.until>=x.from))&&date>=x.from&&(x.until===null||date<x.until))
}
export function togglePlan(e: CalEvent, today: string, enabled: boolean): CalEvent {
 if (!isIsoDate(today)) throw Error('invalid planning date')
 const xs=(e.planExclusions??[]).map(x=>({...x}))
 if(e.planOffFrom){xs.push({from:e.planOffFrom,until:null});xs.sort((a,b)=>a.from.localeCompare(b.from))}
 if(!intervalsValid(xs))throw Error('invalid planning intervals')
 if(xs.some(x=>x.from>today|| (x.until!==null&&x.until>today)))throw Error('planning history cannot be edited retroactively')
 if(enabled){const last=xs.at(-1);if(last?.until===null)last.until=today}
 else if(countsInPlan({...e,planOffFrom:null,planExclusions:xs},today))xs.push({from:today,until:null})
 return {...e,planOffFrom:null,planExclusions:xs}
}
export function planningValid(s: Settings) {
 if(s.expectedIncome!=null&&(!Number.isFinite(s.expectedIncome)||s.expectedIncome<0))return false
 if(s.expectedFrom!=null&&!isPlanMonth(s.expectedFrom))return false
 if(s.planVersion!=null&&s.planVersion!==1)return false
 if(s.openingIncomeReceived!=null&&(s.planVersion!==1||!Number.isFinite(s.openingIncomeReceived)||s.openingIncomeReceived<0))return false
 if(s.balanceDate!=null&&(!isIsoDate(s.balanceDate)||ymKey(monthOf(s.balanceDate,s.monthStartDay))!==ymKey(s.firstMonth)))return false
 if(s.planVersion===1&&(!s.balanceDate||s.buckets.some(b=>!Number.isFinite(b.startingBalance))))return false
 const xs=s.incomePlans
 return xs==null || (Array.isArray(xs)&&xs.every((x,i)=>x&&isPlanMonth(x.from)&&Number.isFinite(x.amount)&&x.amount>=0&&(!i||xs[i-1].from<x.from)))
}
export function setExpectedIncome(s: Settings, from: string, amount: number): Settings {
 if(!isPlanMonth(from)||!Number.isFinite(amount)||amount<0)throw Error('invalid expected income')
 // Canonicalize the old zero-plan snapshot BEFORE revising its budget, so the
 // previously received amount is retained independently of the new expectation.
 const first=ymKey(s.firstMonth)
 const opening=legacyOpeningIncome(s)
 if(opening>0)s={...s,openingIncomeReceived:opening,incomePlans:s.incomePlans!.map(x=>x.from===first?{...x,amount:opening}:x)}
 const xs=[...(s.incomePlans??[])].filter(x=>x.from<from)
 if(!xs.length&&s.expectedIncome!=null&&(s.expectedFrom??ymKey(s.firstMonth))<from)xs.push({from:s.expectedFrom??ymKey(s.firstMonth),amount:s.expectedIncome})
 return {...s,incomePlans:[...xs.filter(x=>x.from!==from),{from,amount}].sort((a,b)=>a.from.localeCompare(b.from))}
}
