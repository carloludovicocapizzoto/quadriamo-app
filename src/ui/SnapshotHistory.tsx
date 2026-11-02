import type {ClassifiedTx,Settings} from '../engine'
import {useI18n} from '../i18n/core'
import {TxRow} from './TxRow'
export function SnapshotHistory({rows,settings,onOpen}:{rows:ClassifiedTx[];settings:Settings;onOpen:(tx:ClassifiedTx)=>void}){
 const {t}=useI18n();if(!rows.length)return null
 return <section data-testid="snapshot-history"><h2 className="sec-title">{t('plan.history')}</h2><p className="small muted">{t('plan.beforeSnapshot')}</p><ul className="tx-list">{rows.map(tx=><TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen}/>)}</ul></section>
}
