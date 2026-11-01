// Planning is deliberately independent of the cash/budget engine approved in #19.
import { allocate, recurringOf } from './month'
import { minorDigits } from './bankNumbers'
import { isPlanMonth, planningValid } from './planContract'
import { ymKey } from './dates'
import { safeToSpend } from './spend'
import { SPLIT } from './types'
import type { Bucket, MonthResult, Settings } from './types'
export function monthPlanning(r: MonthResult, s: Settings, today: string) {
  if(!planningValid(s))return null
  const key=ymKey(r.ym)
  const scheduled=s.incomePlans?.filter(x=>x.from<=key).at(-1)
  // Initial 2I backups encoded an already-received salary as a zero first plan.
  // Read that representation without mutating the restored document or its balances.
  const legacyOpening=s.planVersion===1&&s.openingIncomeReceived==null&&key===ymKey(s.firstMonth)&&scheduled?.from===key&&scheduled.amount===0&&(s.expectedIncome??0)>0
  const n = legacyOpening ? s.expectedIncome : scheduled?.amount ?? s.expectedIncome
  if (n == null || !Number.isFinite(n) || n < 0 || (!scheduled && s.expectedFrom && (!isPlanMonth(s.expectedFrom) || key < s.expectedFrom))) return null
  const real = safeToSpend(r, s, today)
  if (!real.length) return null
  const base = n - r.paidFirst
  const parts = allocate(Math.max(0, base), s.buckets.map(b => b.share), minorDigits(s.currency))
  if (parts.length) parts[0] += Math.min(0, base)
  // Only planned income funds this target: opening cash and previous-period reserves
  // belong exclusively to actualAvailable. Actual expenses/commitments still reduce it.
  const planned = safeToSpend({ ...r, buckets: r.buckets.map(b => ({ ...b, remaining: b.remaining - b.carriedOver - b.fromIncome + (parts[s.buckets.findIndex(x => x.id === b.bucket.id)] ?? 0) })) }, s, today)
  const sumFree=(xs:typeof real)=>xs.reduce((a,b)=>a+b.free,0)
  const remainingPlan=planned.reduce((a,b)=>a+Math.max(0,b.free),0), actualAvailable=sumFree(real)
  const explicitExtra=r.transactions.filter(t=>t.type==='income'&&t.category==='extraIncome').reduce((a,t)=>a+(t.amountIn??0),0)
  const regularIncome=r.income-explicitExtra
  const openingReceived=key===ymKey(s.firstMonth)?(s.openingIncomeReceived??(legacyOpening?n:0)):0
  const received=regularIncome+openingReceived
  const missing=Math.max(0,n-received), weights=s.buckets.map(b=>b.share),digits=minorDigits(s.currency)
  // Expected future receipts follow the rule, including recovery of any FIRST deficit.
  // This is funding capacity for a warning, never a ledger entry or a modified balance.
  const ruledReceived=r.transactions.filter(t=>t.type==='income'&&t.bucket===SPLIT&&!t.split).reduce((a,t)=>a+(t.amountIn??0),0)
  const share=(income:number)=>{const b=income-r.paidFirst,a=allocate(Math.max(0,b),weights,digits);if(a.length)a[0]+=Math.min(0,b);return a}
  const before=share(ruledReceived),after=share(ruledReceived+missing),spending=new Set(real.map(b=>b.bucketId))
  const pendingSpendingIncome=s.buckets.reduce((a,b,i)=>a+(spending.has(b.id)?after[i]-before[i]:0),0)
  const shortfall=Math.max(0,remainingPlan-actualAvailable-pendingSpendingIncome)
  const recordedExpenses=r.transactions.filter(t=>t.type==='expense'&&!t.recurring).reduce((a,t)=>a+(t.amountIn??0),0)
  const plannedExpenses=recurringOf(r.ym,r.transactions,s,today).filter(t=>t.type==='expense').reduce((a,t)=>a+(t.planned??0),0)
  return { actualAvailable, remainingPlan, pendingSpendingIncome, shortfall:shortfall>10**(-digits)*s.buckets.length?shortfall:0, cashGap:Math.max(0,remainingPlan-actualAvailable), recordedExpenses, plannedExpenses, budgetExpenses:r.spent, expected: n, received: Math.min(n,received), receivedTotal: r.income, missing, extra: explicitExtra + Math.max(0, received - n), actualDaily: real.reduce((a,b)=>a+b.perDay,0), plannedDaily: planned.reduce((a,b)=>a+b.perDay,0) }
}
export function splitOpeningBalance(buckets: Bucket[], amount: number, currency: string): Bucket[] {
  if(!Number.isFinite(amount))throw Error('invalid opening balance')
  const parts = allocate(amount, buckets.map(b=>b.share), minorDigits(currency))
  return buckets.map((b,i)=>({...b,startingBalance:parts[i]}))
}
