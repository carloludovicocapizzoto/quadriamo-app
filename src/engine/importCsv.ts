// Import degli estratti conto in CSV (Revolut, N26 e formati generici delle banche).
// Restituisce righe "grezze": data, descrizione, importo con segno (negativo = uscita), valuta.
import { isIsoDate } from './dates'
import { amountClue, detectDateOrder, detectDecimalMark, minorDigits, parseDateWith, parseMoney, type AmountProblem, type DateOrder, type DecimalMark, type Money } from './bankNumbers'

export interface ImportRow { date: string; description: string; amount: number; currency: string | null }

export interface ColumnMap { date: number; description: number[]; amount: number | null; debit: number | null; credit: number | null;
  currency: number | null; fee: number | null; state: number | null }

const SEPARATORS = [',', ';', '\t'] as const
const SAMPLE_LINES = 50

/**
 * Il separatore della tabella, non della prima riga: le banche mettono spesso prima delle intestazioni righe descrittive
 * (titolo, conto, periodo) con virgole o punti e virgola. Vince il separatore che dà più righe con lo stesso numero di celle.
 */
function detectSeparator(text: string): string {
  const counts = new Map<string, number[]>(SEPARATORS.map(d => [d, []]))
  let quoted = false, line = new Map<string, number>(), lines = 0
  const end = () => { for (const d of SEPARATORS) counts.get(d)!.push(line.get(d) ?? 0); line = new Map(); lines++ }
  for (let i = 0; i < text.length && lines < SAMPLE_LINES; i++) {
    const ch = text[i]
    if (ch === '"' && quoted && text[i + 1] === '"') i++
    else if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\r' || ch === '\n')) { if (ch === '\r' && text[i + 1] === '\n') i++; end() }
    else if (!quoted && (SEPARATORS as readonly string[]).includes(ch)) line.set(ch, (line.get(ch) ?? 0) + 1)
  }
  if (line.size) end()
  let best: string = SEPARATORS[0], score = -1, width = -1
  for (const d of SEPARATORS) {
    // righe con lo stesso numero (non nullo) di separatori: la tabella; a parità, quella più larga
    const tally = new Map<number, number>()
    for (const n of counts.get(d)!) if (n > 0) tally.set(n, (tally.get(n) ?? 0) + 1)
    for (const [n, rows] of tally) if (rows > score || (rows === score && n > width)) { best = d; score = rows; width = n }
  }
  return best
}

/** Divide un CSV in righe e celle, rispettando le virgolette. Riconosce il separatore (, ; o tab). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const sep = detectSeparator(clean)
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim())) rows.push(row.map(c => c.trim()))
      row = []
    } else cell += ch
  }
  if (q) return []
  row.push(cell)
  if (row.some(c => c.trim())) rows.push(row.map(c => c.trim()))
  return rows
}

const find = (h: string[], re: RegExp, not?: RegExp) => h.findIndex(x => re.test(x) && !(not && not.test(x)))

/** Indovina le colonne dall'intestazione (italiano, inglese, francese, spagnolo, tedesco). */
export function detectColumns(header: string[]): ColumnMap | null {
  const h = header.map(x => x.toLowerCase())
  const date = [find(h, /completed date/), find(h, /^(booking date|data contabile|data operazione|value date|data valuta)$/),
                find(h, /(^|\s)(date|data|fecha|datum)(\s|$)/), find(h, /date|data|fecha|datum/)].find(i => i >= 0) ?? -1
  const desc = [find(h, /^(description|descrizione|payee|partner name|beneficiario|concepto|libellé|libelle|verwendungszweck)$/),
                find(h, /descr|causale|payee|merchant|concepto|libell|dettagli|details|reference|riferimento/)].filter(i => i >= 0)
  const extraRef = find(h, /payment reference|riferimento|causale/)
  const description = [...new Set([...desc.slice(0, 1), ...(extraRef >= 0 && !desc.includes(extraRef) ? [extraRef] : [])])]
  const amount = find(h, /^(amount|importo|importe|montant|betrag)( \(.*\))?$/) >= 0
    ? find(h, /^(amount|importo|importe|montant|betrag)( \(.*\))?$/) : find(h, /amount|importo|importe|montant|betrag/, /foreign|original|fee/)
  const debit = find(h, /debit|dare|uscit|addebit|cargo/)
  const credit = find(h, /credit|avere|entrat|accredit|abono/)
  if (date < 0 || !description.length || (amount < 0 && debit < 0 && credit < 0)) return null
  return { date, description, amount: amount >= 0 ? amount : null, debit: debit >= 0 ? debit : null, credit: credit >= 0 ? credit : null,
           currency: (() => { const i = find(h, /^(currency|valuta|divisa|moneda|devise|währung)$/); return i >= 0 ? i : null })(),
           fee: (() => { const i = find(h, /^fee$|commission/); return i >= 0 ? i : null })(),
           state: (() => { const i = find(h, /^(state|stato|status)$/); return i >= 0 ? i : null })() }
}

/** Data in vari formati -> "YYYY-MM-DD". Con giorno e mese ambigui (es. 03/04) vale il formato europeo giorno/mese. */
export function parseBankDate(s: string): string | null {
  const t = s.trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s]\d{2}:\d{2})/)
  if (m) return isIsoDate(m[0]) ? m[0] : null
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?=$|\s\d{2}:\d{2})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    const date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    return isIsoDate(date) ? date : null
  }
  m = t.match(/^([a-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/i)
  if (m) {
    const monthNames: Record<string, string> = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10',
      october: '10', nov: '11', november: '11', dec: '12', december: '12',
    }
    const month = monthNames[m[1].toLowerCase()]
    if (!month) return null
    const date = `${m[3]}-${month}-${m[2].padStart(2, '0')}`
    return isIsoDate(date) ? date : null
  }
  return null
}

/** Un importo da solo, senza conoscere il file ("-1.234,56", "1,234.56", "−12,00 €"). Se è ambiguo («1.234») non lo indovina: null. */
export function parseBankAmount(s: string): number | null {
  const c = amountClue(s)
  if (c.kind === 'invalid' || c.kind === 'ambiguous') return null
  const r = parseMoney(s, c.kind === 'decimal' ? c.mark : '.')
  return r.ok ? r.value : null
}

export type SkipReason = 'date' | 'amount' | 'precision' | 'grouping' | 'range' | 'summary' | 'pending' | 'zero'
/** Una riga non importata: il numero di record nel file (l'intestazione è 1) e il perché. Mai righe sparite in silenzio. */
export interface SkippedRow { line: number; reason: SkipReason }
/** Cosa serve sapere prima di importare: la convenzione dei numeri o l'ordine delle date, con qualche esempio dal file. */
export interface StatementNeeds { number?: { samples: string[]; conflicting: boolean }; date?: { samples: string[]; conflicting: boolean } }
export interface StatementOptions { mark?: DecimalMark; order?: DateOrder }

// intestazioni non inglesi: in questi paesi le date sono sempre giorno/mese (in inglese possono essere USA o Regno Unito)
const DAY_FIRST_HEADER = /^(data|descrizione|importo|causale|valuta|datum|betrag|buchungstag|libellé|libelle|montant|fecha|concepto|importe|débit|debit|crédit|dare|avere)\b/i
/** Intestazione non riconosciuta: la prima riga larga quanto la maggior parte delle righe, dopo eventuali righe descrittive. */
function tableStart(all: string[][]): number {
  const widths = new Map<number, number>()
  for (const r of all.slice(0, SAMPLE_LINES)) widths.set(r.length, (widths.get(r.length) ?? 0) + 1)
  const [width] = [...widths].filter(([w]) => w >= 2).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [0]
  return Math.max(0, all.findIndex(r => r.length === width))
}

const SUMMARY = /^(totale|total|totaux|totales|summe|saldo|balance|solde)\b/i

/** Trasforma il CSV in righe pronte per la casella "Da confermare": convenzioni decise sull'intero file, righe escluse sempre spiegate. */
export function readStatement(text: string, map?: ColumnMap, opts: StatementOptions = {}): {
  rows: ImportRow[]; map: ColumnMap | null; header: string[]; error?: 'multiple_sections'
  skipped: SkippedRow[]; needs?: StatementNeeds; mark: DecimalMark | null; order: DateOrder | null
} {
  const all = parseCsv(text)
  const headerIdx = all.findIndex(r => detectColumns(r) != null)
  const top = headerIdx >= 0 ? headerIdx : tableStart(all)
  const header = all[top] ?? []
  const cols = map ?? detectColumns(header)
  const none = { rows: [], header, skipped: [], mark: null, order: null }
  if (!cols) return { ...none, map: null }
  // Distinct sections may describe different accounts or repeat the same transfers.
  // Do not silently import a partial or duplicated consolidated statement.
  if (headerIdx >= 0 && all.slice(headerIdx + 1).some(r => detectColumns(r) !== null))
    return { ...none, map: null, error: 'multiple_sections' }
  const first = top + 1
  const body = all.slice(first)
  const amountCells = body.flatMap(r => [cols.amount, cols.debit, cols.credit, cols.fee].flatMap(i => (i != null && r[i] ? [r[i]] : [])))
  // la convenzione è quella del file; quella scelta da chi importa vale solo se il file non ne dichiara una diversa
  const numbers = detectDecimalMark(amountCells), dates = detectDateOrder(body.map(r => r[cols.date] ?? ''))
  const dayFirst = !dates.order && !dates.conflicting && header.some(h => DAY_FIRST_HEADER.test(h))
  const mark = numbers.mark ?? opts.mark ?? null
  const order = dates.order ?? (dayFirst ? 'dmy' : null) ?? opts.order ?? null
  const needs: StatementNeeds = {}
  if ((numbers.ambiguous || numbers.conflicting) && !opts.mark) needs.number = { samples: numbers.samples, conflicting: numbers.conflicting }
  if ((dates.ambiguous && !dayFirst || dates.conflicting) && !opts.order) needs.date = { samples: dates.samples, conflicting: dates.conflicting }
  if (needs.number || needs.date) return { ...none, map: cols, needs, mark, order }

  const rows: ImportRow[] = [], skipped: SkippedRow[] = []
  body.forEach((r, i) => {
    const line = first + i + 1
    const skip = (reason: SkipReason) => { skipped.push({ line, reason }) }
    if (cols.state != null && r[cols.state] && !/completed|completat|eseguit|booked|contabilizzat/i.test(r[cols.state])) return skip('pending')
    const date = parseDateWith(r[cols.date] ?? '', order)
    if (!date) return skip(SUMMARY.test(r[cols.date] ?? '') || r.some(c => SUMMARY.test(c)) && !/\d{1,4}[/.-]\d/.test(r[cols.date] ?? '') ? 'summary' : 'date')
    const currency = cols.currency != null ? (r[cols.currency] || null) : null
    const digits = minorDigits(currency)
    const read = (i: number | null) => (i == null || !(r[i] ?? '').trim() ? null : parseMoney(r[i], mark ?? '.', digits))
    let minor: number | null = null
    const bad = (m: Money | null) => (m && !m.ok ? m.reason : null)
    if (cols.amount != null || (cols.debit != null && cols.debit === cols.credit)) {
      const a = read(cols.amount ?? cols.debit)
      if (!a || !a.ok) return skip(a ? problem(a.reason) : 'amount')
      minor = a.minor
    } else {
      const d = read(cols.debit), c = read(cols.credit), why = bad(d) ?? bad(c)
      if (why) return skip(problem(why))
      minor = c?.ok && c.minor ? Math.abs(c.minor) : d?.ok && d.minor ? -Math.abs(d.minor) : null
      if (minor == null) return skip('zero')
    }
    if (cols.fee != null) {
      const f = read(cols.fee)
      if (f && !f.ok) return skip(problem(f.reason))
      if (f?.ok) minor -= Math.abs(f.minor)
    }
    if (minor === 0) return skip('zero')
    const description = cols.description.map(j => r[j] ?? '').filter(Boolean).join(' · ')
    rows.push({ date, description, amount: minor / 10 ** digits, currency })
  })
  return { rows, map: cols, header, skipped, mark, order }
}

const problem = (r: AmountProblem): SkipReason => (r === 'format' ? 'amount' : r)
