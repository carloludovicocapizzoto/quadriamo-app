import { FIRST, SPLIT, rowIssues, type ClassifiedTx, type Settings } from '../engine'
import { useI18n } from '../i18n/core'
import { BUCKET_COLORS, bucketName, categoryName } from './names'

/** Una riga di movimento: tocco per modificarla (i ricorrenti si modificano nelle Impostazioni). */
export function TxRow({ tx, settings, onOpen }: { tx: ClassifiedTx; settings: Settings; onOpen: (tx: ClassifiedTx) => void }) {
  const { t, money, date } = useI18n()
  const issues = rowIssues(tx, settings)
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
            {tx.recurring && <em className="tag">{tx.upcoming ? t('tx.upcoming') : t('tx.recurring')}</em>}
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
