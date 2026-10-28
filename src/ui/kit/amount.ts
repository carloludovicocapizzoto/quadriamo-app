// Importi scritti a mano: separatore delle migliaia e decimali come nella lingua dell'utente.
import { amountClue, parseMoney, type DecimalMark } from '../../engine/bankNumbers'
const sepsCache = new Map<string, { group: string; dec: string }>()
function seps(lang: string) {
  let s = sepsCache.get(lang)
  if (!s) {
    const p = new Intl.NumberFormat(lang).formatToParts(12345.6)
    s = { group: p.find(x => x.type === 'group')?.value ?? '', dec: p.find(x => x.type === 'decimal')?.value ?? ',' }
    sepsCache.set(lang, s)
  }
  return s
}

/** Un importo come lo scrive una persona: separatore delle migliaia, decimali solo se ci sono ("1.200", "1.200,50"). */
export function amountText(n: number | null | undefined, lang: string): string {
  if (n == null) return ''
  return new Intl.NumberFormat(lang, { useGrouping: true, minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)
}

/**
 * Rimette in ordine quello che si sta scrivendo: cifre raggruppate a tre, al massimo due decimali.
 * Il separatore delle migliaia lo mette l'app; il punto appena digitato in fondo (tastiera del computer) vale come virgola.
 */
export function groupTyping(raw: string, lang: string): string {
  const { group, dec } = seps(lang)
  const other = dec === ',' ? '.' : ','
  let s = raw.replace(/[\s  ']/g, '')
  const neg = s.startsWith('-')
  if (!s.includes(dec) && s.endsWith(other)) s = s.slice(0, -1) + dec
  const at = s.indexOf(dec)
  const int = (at < 0 ? s : s.slice(0, at)).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const frac = at < 0 ? null : s.slice(at + 1).replace(/\D/g, '').slice(0, 2)
  if (!int && frac == null) return neg ? '-' : ''
  return (neg ? '-' : '') + (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, group) + (frac == null ? '' : dec + frac)
}

/**
 * Parse di un importo scritto dall'utente ("12,50", "12.50", "1.234,56", "1,234.56").
 * Con la lingua il separatore decimale è il suo («1.234» in italiano è milleduecentotrentaquattro, in inglese è rifiutato);
 * senza lingua, tre cifre dopo un separatore solo sono migliaia. Più di due decimali, o «0,123», non diventano mai un altro
 * importo: il valore è rifiutato (null), non arrotondato in silenzio.
 */
export function parseAmount(raw: string, lang?: string): number | null {
  const c = amountClue(raw)
  if (c.kind === 'invalid') return null
  const single: DecimalMark = raw.includes('.') ? '.' : ','
  const mark: DecimalMark = c.kind === 'decimal' ? c.mark
    : c.kind === 'ambiguous' ? (lang ? (seps(lang).dec === '.' ? '.' : ',') : single === '.' ? ',' : '.')
    : '.'
  const r = parseMoney(raw, mark, 2)
  return r.ok ? r.value : null
}
