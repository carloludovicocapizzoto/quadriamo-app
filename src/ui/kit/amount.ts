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
 * Rimette in ordine quello che si sta scrivendo: cifre raggruppate a tre.
 * Il separatore delle migliaia lo mette l'app; il punto appena digitato in fondo (tastiera del computer) vale come virgola.
 * I decimali non si tagliano: «0,123» resta com'è (e parseAmount lo rifiuta), non diventa «0,12» in silenzio.
 */
export function groupTyping(raw: string, lang: string): string {
  const { group, dec } = seps(lang)
  const other = dec === ',' ? '.' : ','
  let s = raw.replace(/[\s  ']/g, '')
  const neg = s.startsWith('-')
  if (!s.includes(dec) && s.endsWith(other)) s = s.slice(0, -1) + dec
  const at = s.indexOf(dec)
  const int = (at < 0 ? s : s.slice(0, at)).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const frac = at < 0 ? null : s.slice(at + 1).replace(/\D/g, '')
  if (!int && frac == null) return neg ? '-' : ''
  return (neg ? '-' : '') + (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, group) + (frac == null ? '' : dec + frac)
}

/** Il campo è da segnare come non leggibile? Il decimale della lingua appena digitato in fondo («1.200,») è ancora a metà, non un errore. */
export function unreadableAmount(text: string, lang: string): boolean {
  const { dec } = seps(lang)
  return /\d/.test(text) && parseAmount(text.endsWith(dec) ? text.slice(0, -1) : text, lang) == null
}

/** Come è arrivato il nuovo testo: digitato un carattere alla volta (con il carattere e la posizione del cursore) o inserito in blocco. */
export type AmountEdit = { kind: 'type'; data?: string | null; caret?: number } | { kind: 'insert' }

/**
 * Il testo incollato (o trascinato, o completato dal sistema) si legge per intero, come lo legge parseAmount:
 * «2.35» in italiano è 2,35, mai 235. Se non ha una lettura sicura resta com'è, segnato come non valido, senza togliere caratteri.
 */
export function pastedAmount(raw: string, lang: string): string {
  const text = raw.trim()
  if (!/\d/.test(text)) return groupTyping(text, lang)
  const value = parseAmount(text, lang)
  return value == null ? text : amountText(value, lang)
}

/**
 * Il testo del campo dopo una modifica. `prev` è il testo di prima, `raw` quello lasciato dal browser.
 * - Inserito in blocco: si legge per intero (pastedAmount).
 * - Se il testo di prima non era già nella forma dell'app (per esempio «0.123» incollato e rifiutato), si lascia com'è:
 *   rimetterlo in ordine potrebbe cambiare l'importo.
 * - Un «.» o «,» digitato che non è il decimale della lingua: con esattamente tre cifre dopo raggruppa le migliaia,
 *   altrimenti è il decimale (se non ce n'è già uno). Così «2» «.» «3» «5» e la sostituzione della virgola con il punto danno 2,35.
 */
export function editAmount(prev: string, raw: string, lang: string, edit: AmountEdit): string {
  if (edit.kind === 'insert') return pastedAmount(raw, lang)
  if (prev && parseAmount(groupTyping(prev, lang), lang) !== parseAmount(prev, lang)) return raw
  const { dec } = seps(lang)
  const ch = edit.data, at = edit.caret ?? raw.length
  if (ch && ch.length === 1 && /[.,]/.test(ch) && ch !== dec && raw[at - 1] === ch && !raw.includes(dec)) {
    // tre cifre dopo: migliaia, come le legge parseAmount nella lingua; altrimenti è il decimale
    if (/^\d*/.exec(raw.slice(at))![0].length !== 3) raw = raw.slice(0, at - 1) + dec + raw.slice(at)
  }
  return groupTyping(raw, lang)
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
