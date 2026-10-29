// Numeri e date degli estratti conto: la convenzione si decide sull'intero file, mai riga per riga.
// Un importo si legge dalla stringa esatta in unità minime della valuta (centesimi per EUR): niente float intermedi,
// niente arrotondamenti silenziosi. Un caso davvero ambiguo («1.234» senza altri indizi) non si indovina: si chiede.

export type DecimalMark = '.' | ','
export type DateOrder = 'dmy' | 'mdy'
export type AmountProblem = 'format' | 'grouping' | 'precision' | 'range'
export type Money = { ok: true; minor: number; value: number } | { ok: false; reason: AmountProblem }

const MAX_INTEGER_DIGITS = 12          // fino a 999 miliardi: oltre, quasi certamente un errore del file
const other = (m: DecimalMark): DecimalMark => (m === '.' ? ',' : '.')

/** Toglie valuta, spazi e apostrofi delle migliaia (anche quelli Unicode) e legge il segno: −, -, +, parentesi contabili, meno finale. */
function clean(raw: string): { neg: boolean; body: string } | null {
  let t = raw.replace(/â‚¬/g, '€').trim()
  t = t.replace(/^(?:[A-Z]{3}|[€$£¥₣])\s*|\s*(?:[A-Z]{3}|[€$£¥₣])$/g, '')
  t = t.replace(/[\s   '’]/g, '').replace(/[−–]/g, '-')
  if (!t) return null
  let neg = false
  if (t.startsWith('(') && t.endsWith(')')) { neg = true; t = t.slice(1, -1) }
  else if (/^[-+]/.test(t)) { neg = t[0] === '-'; t = t.slice(1) }
  else if (/\d-$/.test(t)) { neg = true; t = t.slice(0, -1) }   // «1.234,56-» di alcune banche
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null
  return { neg, body: t }
}

/** Cosa dice un singolo importo sulla convenzione del file. */
export type AmountClue = { kind: 'decimal'; mark: DecimalMark } | { kind: 'ambiguous' } | { kind: 'none' } | { kind: 'invalid' }

export function amountClue(raw: string): AmountClue {
  const c = clean(raw)
  if (!c) return { kind: 'invalid' }
  const b = c.body, dots = b.split('.').length - 1, commas = b.split(',').length - 1
  if (!dots && !commas) return { kind: 'none' }
  if (dots && commas) {
    const mark: DecimalMark = b.lastIndexOf(',') > b.lastIndexOf('.') ? ',' : '.'
    const [int, frac] = [b.slice(0, b.lastIndexOf(mark)), b.slice(b.lastIndexOf(mark) + 1)]
    const g = other(mark) === '.' ? '\\.' : ','
    return new RegExp(`^[1-9]\\d{0,2}(${g}\\d{3})+$`).test(int) && /^\d+$/.test(frac) ? { kind: 'decimal', mark } : { kind: 'invalid' }
  }
  const m: DecimalMark = dots ? '.' : ','
  if ((dots || commas) > 1) {   // lo stesso segno ripetuto è il separatore delle migliaia: il decimale è l'altro
    const g = m === '.' ? '\\.' : ','
    return new RegExp(`^[1-9]\\d{0,2}(${g}\\d{3})+$`).test(b) ? { kind: 'decimal', mark: other(m) } : { kind: 'invalid' }
  }
  const [before, after] = b.split(m)
  if (!/^\d*$/.test(before) || !/^\d*$/.test(after) || (!before && !after)) return { kind: 'invalid' }
  // tre cifre dopo un separatore solo: migliaia o decimali? Solo se la parte intera può essere un gruppo (1-3 cifre, non 0…)
  if (after.length === 3 && /^[1-9]\d{0,2}$/.test(before)) return { kind: 'ambiguous' }
  return { kind: 'decimal', mark: m }
}

/** La convenzione del file dagli indizi di tutti gli importi. Indizi opposti o solo casi ambigui: serve una scelta. */
export function detectDecimalMark(raws: string[]): { mark: DecimalMark | null; ambiguous: boolean; conflicting: boolean; samples: string[] } {
  const votes = new Set<DecimalMark>(), ambiguous: string[] = []
  for (const r of raws) {
    const c = amountClue(r)
    if (c.kind === 'decimal') votes.add(c.mark)
    else if (c.kind === 'ambiguous' && ambiguous.length < 3) ambiguous.push(r.trim())
  }
  if (votes.size === 1) return { mark: [...votes][0], ambiguous: false, conflicting: false, samples: [] }
  if (votes.size > 1) return { mark: null, ambiguous: false, conflicting: true, samples: [] }
  return { mark: null, ambiguous: ambiguous.length > 0, conflicting: false, samples: ambiguous }
}

/** Cifre decimali della valuta (EUR 2, JPY 0, KWD 3); sconosciuta: 2. */
export function minorDigits(currency: string | null | undefined): number {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return 2
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2 }
  catch { return 2 }
}

/** Un importo con una convenzione nota, dalla stringa esatta alle unità minime. Più decimali di quelli della valuta: errore, non arrotondamento. */
export function parseMoney(raw: string, mark: DecimalMark, digits = 2): Money {
  const c = clean(raw)
  if (!c) return { ok: false, reason: 'format' }
  const parts = c.body.split(mark)
  if (parts.length > 2) return { ok: false, reason: 'format' }
  const [int, frac = ''] = parts
  if (frac.includes(other(mark)) || !/^\d*$/.test(frac)) return { ok: false, reason: 'format' }
  if (int.includes(other(mark)) && !new RegExp(`^[1-9]\\d{0,2}(${other(mark) === '.' ? '\\.' : ','}\\d{3})+$`).test(int)) return { ok: false, reason: 'grouping' }
  const digitsInt = int.split(other(mark)).join('')
  if (!/^\d*$/.test(digitsInt) || (!digitsInt && !frac)) return { ok: false, reason: 'format' }
  if (frac.length > digits) return { ok: false, reason: 'precision' }
  const intDigits = digitsInt.replace(/^0+(?=\d)/, '')
  if (intDigits.length > MAX_INTEGER_DIGITS) return { ok: false, reason: 'range' }
  const minor = Number((intDigits || '0') + frac.padEnd(digits, '0'))
  if (!Number.isSafeInteger(minor)) return { ok: false, reason: 'range' }
  const signed = c.neg && minor !== 0 ? -minor : minor            // niente «-0»
  return { ok: true, minor: signed, value: signed / 10 ** digits }
}

// ---------- date ----------
const MONTHS: Record<string, number> = {}
;[
  ['jan january gen gennaio janv janvier ene enero', 1], ['feb february febbraio févr fevr février fevrier febrero', 2],
  ['mar march marzo mars', 3], ['apr april aprile avr avril abr abril', 4], ['may mag maggio mai mayo', 5],
  ['jun june giu giugno juin junio', 6], ['jul july lug luglio juil juillet julio', 7], ['aug august ago agosto août aout', 8],
  ['sep sept september set settembre septembre septiembre setiembre', 9], ['oct october ott ottobre octobre octubre', 10],
  ['nov november novembre noviembre', 11], ['dec december dic dicembre déc dec décembre decembre diciembre', 12],
].forEach(([names, n]) => (names as string).split(' ').forEach(x => { MONTHS[x] = n as number }))

const iso = (y: number, m: number, d: number) => {
  const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const dt = new Date(s + 'T00:00:00Z')
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === s ? s : null
}
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))

/** Data con nome del mese (italiano, inglese, francese, spagnolo): «1 ott 2026», «Oct 1, 2026», «1 de octubre de 2026», «01-Oct-2026». */
function namedDate(t: string): string | null {
  const s = t.toLowerCase().replace(/\./g, '').replace(/\s+de\s+/g, ' ').replace(/,/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  let m = s.match(/^(\d{1,2}) ([a-zà-ÿ]+) (\d{4})$/)
  if (m && MONTHS[m[2]]) return iso(Number(m[3]), MONTHS[m[2]], Number(m[1]))
  m = s.match(/^([a-zà-ÿ]+) (\d{1,2}) (\d{4})$/)
  if (m && MONTHS[m[1]]) return iso(Number(m[3]), MONTHS[m[1]], Number(m[2]))
  return null
}

/** Cosa dice una data sull'ordine giorno/mese del file. */
export function dateClue(raw: string): 'certain' | DateOrder | 'ambiguous' | 'invalid' {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}(?=$|[T\s]\d{2}:\d{2})/.test(t)) return iso(Number(t.slice(0, 4)), Number(t.slice(5, 7)), Number(t.slice(8, 10))) ? 'certain' : 'invalid'
  if (namedDate(t)) return 'certain'
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?=$|\s\d{1,2}:\d{2})/)
  if (!m) return 'invalid'
  const a = Number(m[1]), b = Number(m[2]), y = year(m[3])
  const dmy = iso(y, b, a), mdy = iso(y, a, b)
  if (dmy && mdy) return a === b ? 'certain' : 'ambiguous'
  return dmy ? 'dmy' : mdy ? 'mdy' : 'invalid'
}

export function detectDateOrder(raws: string[]): { order: DateOrder | null; ambiguous: boolean; conflicting: boolean; samples: string[] } {
  const votes = new Set<DateOrder>(), ambiguous: string[] = []
  for (const r of raws) {
    const c = dateClue(r)
    if (c === 'dmy' || c === 'mdy') votes.add(c)
    else if (c === 'ambiguous' && ambiguous.length < 3) ambiguous.push(r.trim())
  }
  if (votes.size === 1) return { order: [...votes][0], ambiguous: false, conflicting: false, samples: [] }
  if (votes.size > 1) return { order: null, ambiguous: false, conflicting: true, samples: [] }
  return { order: null, ambiguous: ambiguous.length > 0, conflicting: false, samples: ambiguous }
}

/** Una data con l'ordine del file (o scelto da chi importa). ISO e nomi dei mesi non dipendono dall'ordine. */
export function parseDateWith(raw: string, order: DateOrder | null): string | null {
  const t = raw.trim()
  const i = t.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s]\d{2}:\d{2})/)
  if (i) return iso(Number(i[1]), Number(i[2]), Number(i[3]))
  const n = namedDate(t)
  if (n) return n
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?=$|\s\d{1,2}:\d{2})/)
  if (!m) return null
  const a = Number(m[1]), b = Number(m[2]), y = year(m[3])
  const dmy = iso(y, b, a), mdy = iso(y, a, b)
  if (a === b) return dmy
  // con l'ordine del file la data deve rispettarlo; senza, vale solo se una lettura sola è possibile (28/10)
  if (order) return order === 'dmy' ? dmy : mdy
  return dmy && mdy ? null : dmy ?? mdy
}
