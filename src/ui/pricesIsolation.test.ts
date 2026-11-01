import { afterEach, expect, it, vi } from 'vitest'
import { activateScope } from '../store/scope'
import { readPrices, saveFetchedPrices } from './livePrices'
import { personal } from '../storage'
afterEach(()=>vi.unstubAllGlobals())
it('a delayed quote response cannot write into another account; corrupt and expired prices are discarded',()=>{
 const map=new Map<string,string>(); vi.stubGlobal('localStorage',{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v)})
 const a=activateScope({environment:'alpha',backend:'synthetic',kind:'account',owner:'A'})
 const live={'bitcoin:eur':{price:12,change:0,at:new Date().toISOString()}}
 expect(saveFetchedPrices(a,'btc',live)).not.toBeNull()
 activateScope({...a.scope,owner:'B'})
 expect(readPrices().live).toEqual({}); expect(saveFetchedPrices(a,'btc',live)).toBeNull(); expect(readPrices().live).toEqual({})
 personal.setJson('quadriamo.prices',{live:{bad:{price:'secret',at:'bad'},old:{price:10,at:'2000-01-01'}},days:{bad:'not an array'}})
 expect(readPrices()).toMatchObject({live:{},days:{}})
})
