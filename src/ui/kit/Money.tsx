import { useI18n } from '../../i18n/core'
import { shownAmount } from '../../engine/bankNumbers'

/**
 * Un importo: le cifre sono il testo, il simbolo della valuta è secondario (più piccolo, meno contrasto).
 * `bare` toglie il simbolo, per le colonne dove la valuta è già detta sopra.
 */
export function Money({ value, currency, bare, className }: { value: number; currency: string; bare?: boolean; className?: string }) {
  const { lang } = useI18n()
  const parts = new Intl.NumberFormat(lang, { style: 'currency', currency, useGrouping: 'always' as unknown as boolean }).formatToParts(shownAmount(value, currency))
  return (
    <span className={className}>
      {parts.map((p, i) => p.type === 'currency' ? (bare ? null : <span key={i} className="cur">{p.value}</span>)
        : p.type === 'literal' && bare ? null : <span key={i}>{p.value}</span>)}
    </span>
  )
}
