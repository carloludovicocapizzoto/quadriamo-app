import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import {defaultSettings,classify} from '../engine'
import {I18nProvider} from '../i18n'
import en from '../i18n/en'
import itDict from '../i18n/it'
import fr from '../i18n/fr'
import es from '../i18n/es'
import {SnapshotHistory} from './SnapshotHistory'
for(const[lang,dict]of Object.entries({en,it:itDict,fr,es}))it('original banking history remains visible and explicitly excluded from the opening snapshot budget: '+lang,()=>{
 const settings={...defaultSettings({firstMonth:{year:2026,month:11}}),planVersion:1 as const,balanceDate:'2026-11-15'}
 const row=classify({id:'old',description:'QA-HISTORY',amount:400,date:'2026-10-30',category:'groceries'},settings)
 const html=renderToStaticMarkup(<I18nProvider start={{lang:lang as 'en',dict}}><SnapshotHistory rows={[row]} settings={settings} onOpen={()=>{}}/></I18nProvider>)
 expect(html).toContain('QA-HISTORY');expect(html).toContain(dict['plan.beforeSnapshot']);expect(html).toContain('400');expect(row.date).toBe('2026-10-30')
})
