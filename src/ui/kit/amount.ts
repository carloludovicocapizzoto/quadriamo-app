// Importi scritti a mano: separatore delle migliaia e decimali come nella lingua dell'utente.
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
