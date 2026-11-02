import { useState } from 'react'
import { todayIso } from '../engine'
import { initializePlan } from '../engine/planOnboarding'
import { useStore } from '../store/context'
import { useI18n } from '../i18n/core'
import { AmountInput } from './kit/AmountInput'
export function PlanOpeningStep(){
 const {state,dispatch}=useStore(),s=state.data!.settings,{t}=useI18n()
 const [expected,setExpected]=useState<number|null>(s.expectedIncome??null),[balance,setBalance]=useState<number|null>(s.planVersion===1?s.buckets.reduce((a,b)=>a+(b.startingBalance??0),0):null),[payday,setPayday]=useState(s.monthStartDay),[received,setReceived]=useState(true),[error,setError]=useState(false)
 const save=()=>{try{if(state.data!.transactions.length||expected==null||balance==null)throw Error();dispatch({type:'setSettings',settings:initializePlan(s,{today:todayIso(),expected,balance,payday,received})});setError(false)}catch{setError(true)}}
 return <div className="txs-rows" data-testid="plan-opening"><p>{t('plan.warning')}</p><label className="txs-row"><span>{t('plan.expected')}</span><AmountInput defaultValue={expected} onValue={setExpected}/></label><label className="txs-row"><span>{t('plan.payday')}</span><input type="number" min={1} max={28} value={payday} onChange={e=>setPayday(Number(e.target.value))}/></label><label className="check"><input type="checkbox" checked={received} onChange={e=>setReceived(e.target.checked)}/>{t('plan.already')}</label><label className="txs-row"><span>{t('plan.opening')}</span><AmountInput defaultValue={balance} onValue={setBalance}/></label><p className="small muted">{t('plan.snapshot')}</p><button type="button" className="btn primary" onClick={save}>{t('plan.apply')}</button>{error&&<p role="alert">{t('plan.invalid')}</p>}{s.planVersion===1&&<p role="status">{t('settings.saved')}</p>}</div>
}
