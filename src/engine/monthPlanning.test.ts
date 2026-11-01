import { expect, it } from 'vitest'
import { computeMonth, defaultSettings, safeToSpend } from '.'
import { monthPlanning, splitOpeningBalance } from './monthPlanning'
it.each(['EUR','JPY','KWD'])('planning preserves actual balances and currency allocation: %s', currency=>{
 const s={...defaultSettings({firstMonth:{year:2026,month:11}}),currency,expectedIncome:1000}
 const tx=[{id:'a',date:'2026-11-02',description:'synthetic',category:'salary',amount:100}]
 const before=computeMonth(s.firstMonth,tx,s,'2026-11-03'), cash=safeToSpend(before,s,'2026-11-03'), snapshot=JSON.stringify(before)
 const p=monthPlanning(before,s,'2026-11-03')!
 expect(p.plannedDaily).toBeGreaterThan(p.actualDaily); expect(p.missing).toBe(900)
 expect(safeToSpend(before,s,'2026-11-03')).toEqual(cash); expect(JSON.stringify(before)).toBe(snapshot)
 const b=splitOpeningBalance(s.buckets,10.001,currency),digits=currency==='JPY'?0:currency==='KWD'?3:2
 expect(b.reduce((a,b)=>a+Math.round(b.startingBalance!*10**digits),0)).toBe(Math.round(10.001*10**digits))
 expect(monthPlanning(before,{...s,expectedFrom:'2026-12'},'2026-11-03')).toBeNull()
 expect(monthPlanning(before,{...s,expectedIncome:NaN},'2026-11-03')).toBeNull()
 expect(JSON.parse(JSON.stringify(s)).expectedIncome).toBe(1000)
})
