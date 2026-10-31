import { useContext } from 'react'
import { FIRST, SPLIT, monthOf, rowIssues, validLink, ymKey, type ClassifiedTx, type Settings } from '../engine'
import { StoreContext } from '../store/context'
import { useI18n } from '../i18n/core'
import { BUCKET_COLORS, bucketName, categoryName } from './names'

/** Una riga di movimento: tocco per modificarla (i ricorrenti si modificano nelle Impostazioni). */
export function TxRow({ tx, settings, onOpen }: { tx: ClassifiedTx; settings: Settings; onOpen: (tx: ClassifiedTx) => void }) {
  const { t, money, date } = useI18n()
  // con tutti i movimenti si vede anche il secondo pagamento collegato alla stessa scadenza
  const issues = rowIssues(tx, settings, useContext(StoreContext)?.state.data?.transactions)
  // un pagamento collegato conta nel periodo della scadenza che paga: se è un altro mese rispetto alla sua data, lo dice
  const link = validLink(tx, settings)
  const otherPeriod = link && tx.date && ymKey(monthOf(link.date, settings.monthStartDay)) !== ymKey(monthOf(tx.date, settings.monthStartDay))
  const cat = settings.categories.find(c => c.id === tx.category)
  const bucket = settings.buckets.find(b => b.id === tx.bucket)
  const sign = tx.type === 'income' ? '+' : '−'
  const amount = tx.amountIn ?? tx.amount
  return (
    <li>
      <button className={`tx${issues.length ? ' tx-bad' : ''}${tx.upcoming ? ' tx-upcoming' : ''}`} onClick={() => onOpen(tx)}>
        {/* il blocco della parte da cui escono i soldi: inchiostro se pagato prima delle parti (affitto); le entrate non ne hanno */}
        <span className="tx-block" title={bucket ? bucketName(bucket, t) : undefined}
              style={{ ['--c' as string]: tx.type === 'income' ? 'transparent' : tx.bucket === FIRST ? 'var(--text)' : BUCKET_COLORS[settings.buckets.findIndex(b => b.id === tx.bucket)] ?? 'var(--fill-2)' }} />
        <span className="tx-main">
          <span className="tx-desc">{tx.description || categoryName(cat, t)}</span>
          <span className="tx-meta">
            <span className="tx-date">{tx.date ? date(tx.date) : '—'}</span>{' · '}
            {tx.category ? categoryName(cat, t) : t('check.missingCategory')}
            {tx.bucket === SPLIT ? ` · ${t('tx.split')}` : ''}
            {/* spesa fissa: prevista (in arrivo), impegnata (dal suo giorno conta nel budget, ma nessuno l'ha confermata) o pagata */}
            {otherPeriod && <em className="tag">{t('tx.forDue', { date: date(link.date) })}</em>}
            {tx.recurring && <em className="tag">{tx.upcoming ? t('tx.upcoming') : tx.confirmed ? t('tx.paidTag') : t('tx.committed')}</em>}
          </span>
          {issues.length > 0 && <span className="tx-issue">{issues.map(k => t(`check.${k}`)).join(' · ')}</span>}
        </span>
        <span className={`tx-amount${tx.type === 'income' ? ' income' : ''}`}>
          {amount != null ? `${sign}${money(amount, settings.currency)}` : '—'}
        </span>
      </button>
    </li>
  )
}
