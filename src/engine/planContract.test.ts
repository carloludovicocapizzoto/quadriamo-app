import {expect,it} from 'vitest'
import {defaultSettings,computeMonth,safeToSpend,validLink} from '.'
import {initializePlan} from './planOnboarding'
import {togglePlan,countsInPlan,setExpectedIncome} from './planContract'
import {monthPlanning} from './monthPlanning'
import {validateSettings} from '../store/validate'
import {parseBackup} from '../store/backup'
import {reconcile} from '../sync/protocol'
import {widenFirstMonth} from '../store/model'
const base=()=>defaultSettings({firstMonth:{year:2026,month:11}})
it.each(['EUR','JPY','KWD'])('opening snapshot is actual money, never income; %s',currency=>{
 const s=initializePlan({...base(),currency,events:[]},{today:'2026-11-15',expected:1000,payday:1,received:true,balance:1000})
 expect(validateSettings(s)).toEqual([])
 const r=computeMonth(s.firstMonth,[],s,'2026-11-15');expect(r.income).toBe(0);expect(r.buckets.reduce((a,b)=>a+b.remaining,0)).toBe(1000)
 expect(monthPlanning(r,s,'2026-11-15')?.expected).toBe(0)
 const old={id:'old',date:'2026-10-30',description:'historic',category:'groceries',amount:400}
 expect(widenFirstMonth(s,old)).toBe(s)
 const withOld=computeMonth(s.firstMonth,[old,{...old,id:'pre',date:'2026-11-01'}],s,'2026-11-15');expect(withOld.buckets.reduce((a,b)=>a+b.remaining,0)).toBe(1000)
 expect(old.date).toBe('2026-10-30')
 expect(computeMonth({year:2026,month:10},[old],s,'2026-11-15').buckets.reduce((a,b)=>a+b.remaining,0)).toBe(0)
 const next=computeMonth({year:2026,month:12},[],s,'2026-12-01');expect(monthPlanning(next,s,'2026-12-01')?.expected).toBe(1000)
})
it('nonretroactive toggles preserve already counted due dates, while real linked payments always count',()=>{
 const s=base(),e={...s.events[0],id:'rent-test',title:'Synthetic bill',date:'2026-11-02',category:'fixedCosts',kind:'payment' as const,amount:400,repeat:{every:1,unit:'month' as const},done:[],active:true}
 const off=togglePlan(e,'2026-11-03',false),on=togglePlan(off,'2026-12-10',true)
 expect(countsInPlan(on,'2026-11-02')).toBe(true);expect(countsInPlan(on,'2026-12-02')).toBe(false);expect(countsInPlan(on,'2027-01-02')).toBe(true)
 const settings={...s,events:[on]};const income={id:'i',date:'2026-12-01',category:'salary',description:'synthetic',amount:1000}
 expect(computeMonth({year:2026,month:12},[income],settings,'2026-12-20').spent).toBe(0)
 const payment={id:'p',date:'2026-12-03',category:'fixedCosts',description:'synthetic',amount:400,occurrence:{eventId:e.id,date:'2026-12-02'}}
 expect(validLink(payment,settings)).not.toBeNull();expect(computeMonth({year:2026,month:12},[income,payment],settings,'2026-12-20').spent).toBe(400)
 expect(()=>togglePlan(on,'2026-11-01',false)).toThrow()
})
it('income revisions keep previous planning periods, extras and banking data separate; backup/CAS retain contracts',()=>{
 const s=initializePlan({...base(),events:[]},{today:'2026-11-02',expected:1000,payday:1,received:false,balance:100})
 const revised=setExpectedIncome(s,'2026-12',1200)
 const tx=[{id:'a',date:'2026-11-03',description:'a',category:'salary',amount:600},{id:'b',date:'2026-11-04',description:'b',category:'salary',amount:500}]
 const r=computeMonth(s.firstMonth,tx,revised,'2026-11-10');expect(monthPlanning(r,revised,'2026-11-10')).toMatchObject({expected:1000,received:1100,extra:100,missing:0})
 expect(safeToSpend(r,revised,'2026-11-10')).toEqual(safeToSpend(r,{...revised,expectedIncome:9000},'2026-11-10'))
 const doc={version:1 as const,settings:revised,transactions:tx},copy=parseBackup(JSON.stringify(doc));expect(copy.settings.incomePlans).toEqual(revised.incomePlans)
 const a=structuredClone(doc),b=structuredClone(doc);a.settings=setExpectedIncome(a.settings,'2026-12',1300);b.settings=setExpectedIncome(b.settings,'2026-12',1400)
 expect(reconcile(doc,a,b).paths.some(p=>p.includes('incomePlans'))).toBe(true)
 expect(()=>parseBackup(JSON.stringify({...doc,settings:{...revised,incomePlans:[{from:'2026-99',amount:1}]}}))).toThrow()
 expect(validateSettings({...revised,expectedIncome:Infinity})).toContain('monthlyPlan')
})

it('opening boundary preserves P1-02 and a December/January custom period',()=>{
 let s=initializePlan({...base(),events:[]},{today:'2026-11-01',expected:1000,payday:1,received:true,balance:1000})
 const event={id:'old-due',title:'Synthetic',kind:'payment' as const,category:'fixedCosts',amount:400,date:'2026-10-30',repeat:null,until:null,done:[],active:true}
 s={...s,events:[event]};const tx={id:'p',date:'2026-11-02',description:'synthetic',category:'fixedCosts',amount:400,occurrence:{eventId:event.id,date:event.date}}
 expect(validLink(tx,s)).toBeNull();expect(computeMonth(s.firstMonth,[tx],s,'2026-11-03').buckets.reduce((a,b)=>a+b.remaining,0)).toBe(600);expect(tx.date).toBe('2026-11-02')
 const custom=initializePlan({...base(),events:[{...event,date:'2026-12-27'}]},{today:'2026-12-30',expected:1000,payday:27,received:true,balance:1000})
 expect(custom.firstMonth).toEqual({year:2027,month:1});expect(computeMonth(custom.firstMonth,[],custom,'2027-01-05').spent).toBe(0)
 const pay={...tx,date:'2027-01-02',occurrence:{eventId:event.id,date:'2026-12-27'}}
 expect(validLink(pay,custom)).not.toBeNull();expect(computeMonth(custom.firstMonth,[pay],custom,'2027-01-05').buckets.reduce((a,b)=>a+b.remaining,0)).toBe(600)
})

it('malformed unvalidated stored metadata never suppresses a cost or crashes the financial engine',()=>{expect(countsInPlan({planExclusions:{} as never,planOffFrom:'bad'},'2026-11-01')).toBe(true);expect(countsInPlan({planExclusions:[null] as never},'2026-11-01')).toBe(true);const s={...base(),incomePlans:{} as never};const r=computeMonth(s.firstMonth,[],s,'2026-11-02');expect(monthPlanning(r,s,'2026-11-02')).toBeNull()})

it('an unversioned legacy backup does not partially activate the opening snapshot rules',()=>{const s=base();const e={id:'legacy',title:'Synthetic',kind:'payment' as const,category:'fixedCosts',amount:50,date:'2026-11-01',repeat:null,until:null,done:[],active:true};const t={id:'income',date:'2026-11-03',description:'synthetic',category:'salary',amount:100};const old={...s,events:[e]};expect(computeMonth(s.firstMonth,[t],{...old,balanceDate:'2026-11-02'},'2026-11-05').spent).toBe(computeMonth(s.firstMonth,[t],old,'2026-11-05').spent)})
