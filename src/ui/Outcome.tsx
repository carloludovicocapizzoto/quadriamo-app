import type { ReactNode } from 'react'
import { Money } from './kit/Money'

/**
 * Il protagonista di Mese e Anno: un importo grande (rosso se è uno sforamento), una frase che dice cos'è,
 * sotto una riga sola di totali. Nessun riquadro.
 */
export function Outcome({ value, currency, label, detail, totals, children }: {
  value: number | null; currency: string; label: string; detail?: ReactNode
  totals: { label: string; value: number | string | null }[]; children?: ReactNode
}) {
  return (
    <section className="outcome">
      {value == null ? <span className="outcome-amount">—</span>
        : <Money className={`outcome-amount${value < 0 ? ' bad' : ''}`} value={Math.abs(value)} currency={currency} />}
      <p className="outcome-label">{label}</p>
      {children}
      {detail && <p className="outcome-detail">{detail}</p>}
      <dl className={`outcome-row n${totals.length}`}>
        {totals.map(x => <div key={x.label}><dt>{x.label}</dt><dd>{typeof x.value === 'number' ? <Money value={x.value} currency={currency} /> : x.value ?? '—'}</dd></div>)}
      </dl>
    </section>
  )
}
