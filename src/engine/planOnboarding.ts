import { monthOf, nextMonth, ymKey, isIsoDate } from './dates'
import { splitOpeningBalance } from './monthPlanning'
import type { Settings } from './types'
export interface OpeningPlan { today:string; expected:number; payday:number; received:boolean; balance:number }
export function initializePlan(s:Settings,x:OpeningPlan):Settings {
 if(!isIsoDate(x.today)||!Number.isFinite(x.expected)||x.expected<0||!Number.isFinite(x.balance)||x.balance<0||!Number.isInteger(x.payday)||x.payday<1||x.payday>28)throw Error('invalid opening plan')
 const firstMonth=monthOf(x.today,x.payday),from=ymKey(firstMonth)
 return {...s,planVersion:1,balanceDate:x.today,openingIncomeReceived:x.received?x.expected:0,firstMonth,monthStartDay:x.payday,buckets:splitOpeningBalance(s.buckets,x.balance,s.currency),expectedIncome:x.expected,expectedFrom:from,incomePlans:[{from,amount:x.expected},{from:ymKey(nextMonth(firstMonth)),amount:x.expected}]}
}
