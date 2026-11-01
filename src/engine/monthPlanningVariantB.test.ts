import {expect,it} from 'vitest'
import {computeMonth,defaultSettings} from '.'
import {monthPlanning} from './monthPlanning'
import {setExpectedIncome} from './planContract'
import {parseBackup} from '../store/backup'
const today='2026-11-10',ym={year:2026,month:11}
const base=(currency='EUR')=>({...defaultSettings({firstMonth:ym,currency}),expectedIncome:1500})
const pay=(amount:number,id='salary',category='salary')=>({id,category,amount,date:'2026-11-02',description:'Synthetic'})
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
