import { classify, type ClassifiedTx, type MonthResult, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { Checks } from './Checks'
import { InboxView } from './InboxView'
import { TxRow } from './TxRow'

export function TransactionsView({ r, settings, undated, onOpen }: {
  r: MonthResult; settings: Settings; undated: Transaction[]; onOpen: (tx: ClassifiedTx) => void
}) {
  const { t } = useI18n()
  const rows = [...r.transactions].reverse()     // i più recenti in alto
  return (
    <>
      <InboxView settings={settings} />
      {undated.length > 0 && (
        <section className="card card-bad">
          <h3 className="h-plain">{t('tx.undated')}</h3>
          <ul className="tx-list">{undated.map(tx =>
            <TxRow key={tx.id} tx={classify(tx, settings)} settings={settings} onOpen={onOpen} />)}</ul>
        </section>
      )}
      <section className="card">
        <div className="card-head"><span /><Checks checks={r.checks} /></div>
        {rows.length
          ? <ul className="tx-list">{rows.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
          : <p className="muted">{t('tx.empty')}</p>}
      </section>
    </>
  )
}
