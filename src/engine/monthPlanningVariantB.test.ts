import {expect,it} from 'vitest'
import {computeMonth,defaultSettings} from '.'
import {monthPlanning} from './monthPlanning'
import {setExpectedIncome} from './planContract'
import {parseBackup} from '../store/backup'
import {initializePlan} from './planOnboarding'
const today='2026-11-10',ym={year:2026,month:11}
const base=(currency='EUR')=>({...defaultSettings({firstMonth:ym,currency}),expectedIncome:1500})
const pay=(amount:number,id='salary',category='salary')=>({id,category,amount,date:'2026-11-02',description:'Synthetic'})
it.each(['EUR','JPY','KWD'])('B: snapshot cash and carryover cannot fund the planned target (%s)',currency=>{
 const run=(balance:number)=>{const s=initializePlan({...base(currency),events:[]},{today,expected:1500,payday:1,received:true,balance});const r=computeMonth(ym,[],s,today);return {s,r,p:monthPlanning(r,s,today)!}}
 const a=run(1000),b=run(10000)
 expect(a.p.plannedDaily).toBe(b.p.plannedDaily);expect(a.p.plannedDaily).toBeCloseTo(1125/21)
 expect(a.p.expected).toBe(1500);expect(a.p.missing).toBe(0);expect(a.p.actualAvailable).toBeLessThan(b.p.actualAvailable)
 expect(a.r.income).toBe(0);expect(a.r.buckets.reduce((n,b)=>n+b.remaining,0)).toBe(1000)
 const carried=computeMonth({year:2026,month:12},[],a.s,'2026-12-01',{[a.s.buckets[0].id]:9000})
 const empty=computeMonth({year:2026,month:12},[],a.s,'2026-12-01',{})
 expect(monthPlanning(carried,a.s,'2026-12-01')!.plannedDaily).toBe(monthPlanning(empty,a.s,'2026-12-01')!.plannedDaily)
})
it.each(['EUR','JPY','KWD'])('B: tranches, late salary, extras and FX preserve target and ledger (%s)',currency=>{
 const s=base(currency),run=(tx:ReturnType<typeof pay>[])=>{const r=computeMonth(ym,tx,s,today),copy=JSON.stringify(r),p=monthPlanning(r,s,today)!;expect(JSON.stringify(r)).toBe(copy);return {r,p}}
 const initial=run([pay(100)])
 for(const tx of [[],[pay(100),pay(500,'second')],[pay(1500)],[pay(100),pay(300,'extra','extraIncome')]]){
  const {r,p}=run(tx);expect(p.plannedDaily).toBe(initial.p.plannedDaily);expect(p.shortfall).toBe(0)
  expect(r.income).toBe(tx.reduce((a,t)=>a+t.amount,0));expect(r.buckets.reduce((a,b)=>a+b.remaining,0)).toBe(r.income)
 }
 const extra=run([pay(100),pay(300,'extra','extraIncome')]).p;expect(extra).toMatchObject({missing:1400,extra:300,received:100,receivedTotal:400})
 const fx={...pay(10),currency:'USD',fxRate:2};const r=computeMonth(ym,[fx],s,today);expect(monthPlanning(r,s,today)!.plannedDaily).toBe(initial.p.plannedDaily)
 const changed=setExpectedIncome(s,'2026-11',1800);expect(monthPlanning(initial.r,changed,today)!.plannedDaily).toBeGreaterThan(initial.p.plannedDaily);expect(initial.r.income).toBe(100)
 const doc=parseBackup(JSON.stringify({version:1,settings:changed,transactions:[pay(100)]}));expect(monthPlanning(computeMonth(ym,doc.transactions,doc.settings,today),doc.settings,today)!.expected).toBe(1800)
})
it('B: warning compares residual monetary funding, includes FIRST recovery and never counts extras as salary',()=>{
 const s={...base(),events:[{id:'rent',title:'Synthetic rent',kind:'payment' as const,category:'rent',amount:400,date:'2026-11-25',repeat:null,until:null,done:[],active:true}]}
 const tx=[pay(100)],r=computeMonth(ym,tx,s,today),p=monthPlanning(r,s,today)!
 expect(p.shortfall).toBe(0);expect(p.cashGap).toBeGreaterThan(0);expect(p.plannedExpenses).toBe(400);expect(p.recordedExpenses).toBe(0)
 const linked={...pay(400,'rent-paid','rent'),date:'2026-11-27',occurrence:{eventId:'rent',date:'2026-11-25'}}
 const paid=computeMonth(ym,[...tx,linked],s,'2026-11-28'),pp=monthPlanning(paid,s,'2026-11-28')!;expect(pp.plannedExpenses).toBe(400);expect(pp.recordedExpenses).toBe(400);expect(paid.spent).toBe(400)
 const diverted={...pay(1400,'diverted'),paidFrom:'investments'}
 const deficit=monthPlanning(computeMonth(ym,[...tx,diverted],s,today),s,today)!;expect(deficit.shortfall).toBeGreaterThan(0);expect(deficit.missing).toBe(0)
 const withExtra=monthPlanning(computeMonth(ym,[...tx,{...pay(300,'extra','extraIncome'),paidFrom:'investments'}],s,today),s,today)!;expect(withExtra.shortfall).toBe(0);expect(withExtra.missing).toBe(1400)
})
it.each(['EUR','JPY','KWD'])('B: boundaries, received snapshot, zero budget and legacy recovery (%s)',currency=>{
 const s=initializePlan({...base(currency),events:[]},{today:'2026-12-27',expected:1500,payday:27,received:true,balance:100})
 for(const day of ['2026-12-27','2027-01-26']){
  const r=computeMonth(s.firstMonth,[],s,day),p=monthPlanning(r,s,day)!
  expect(p.expected).toBe(1500);expect(p.missing).toBe(0);expect(p.shortfall).toBeGreaterThan(0);expect(r.income).toBe(0)
  expect(p.plannedDaily).toBeCloseTo(p.remainingPlan/(day==='2026-12-27'?31:1))
 }
 const legacy={...s,openingIncomeReceived:undefined,incomePlans:s.incomePlans!.map((x,i)=>i?x:{...x,amount:0})}
 const copy=parseBackup(JSON.stringify({version:1,settings:legacy,transactions:[]}))
 const p=monthPlanning(computeMonth(s.firstMonth,[],copy.settings,'2027-01-01'),copy.settings,'2027-01-01')!
 expect(p).toMatchObject({expected:1500,received:1500,missing:0})
 const revised=setExpectedIncome(legacy,'2027-01',1800)
 expect(monthPlanning(computeMonth(s.firstMonth,[],revised,'2027-01-01'),revised,'2027-01-01')).toMatchObject({expected:1800,received:1500,missing:300})
 const zero=setExpectedIncome(s,'2027-01',0)
 expect(monthPlanning(computeMonth(s.firstMonth,[],zero,'2027-01-01'),zero,'2027-01-01')!.plannedDaily).toBe(0)
 const noPlan={...base(currency),expectedIncome:null};expect(monthPlanning(computeMonth(ym,[],noPlan,today),noPlan,today)).toBeNull()
})
