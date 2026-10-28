// Import degli estratti conto in CSV (Revolut, N26 e formati generici delle banche).
// Restituisce righe "grezze": data, descrizione, importo con segno (negativo = uscita), valuta.
import { isIsoDate } from './dates'

export interface ImportRow { date: string; description: string; amount: number; currency: string | null }

export interface ColumnMap { date: number; description: number[]; amount: number | null; debit: number | null; credit: number | null;
  currency: number | null; fee: number | null; state: number | null }

/** Divide un CSV in righe e celle, rispettando le virgolette. Riconosce il separatore (, ; o tab). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const counts = [',', ';', '\t'].map(d => {
    let count = 0, quoted = false
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i]
      if (ch === '"' && quoted && clean[i + 1] === '"') i++
      else if (ch === '"') quoted = !quoted
      else if (!quoted && (ch === '\r' || ch === '\n')) break
      else if (!quoted && ch === d) count++
    }
    return [d, count] as const
  })
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0]
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

/** Importo bancario -> numero con segno ("-1.234,56", "1,234.56", "−12,00 €"). */
export function parseBankAmount(s: string): number | null {
  let t = s.replace(/â‚¬/g, '€').replace(/[\s€$£]|EUR|USD|GBP|CHF/g, '').replace('−', '-')
  if (!t) return null
  const neg = t.startsWith('-') || (t.startsWith('(') && t.endsWith(')'))
  if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1)
  else t = t.replace(/^[-+]/, '')
  if (!/^[\d.,]+$/.test(t)) return null
  const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.')
  if (lc > -1 && ld > -1) {
    if (!(lc > ld ? /^\d{1,3}(\.\d{3})+,\d+$/ : /^\d{1,3}(,\d{3})+\.\d+$/).test(t)) return null
    t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  }
  else if (lc > -1) t = t.replace(',', '.')
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

/** Trasforma il CSV in righe pronte per la casella "Da confermare". */
export function readStatement(text: string, map?: ColumnMap): { rows: ImportRow[]; map: ColumnMap | null; header: string[]; error?: 'multiple_sections' } {
  const all = parseCsv(text)
  const headerIdx = all.findIndex(r => detectColumns(r) != null)
  const header = all[headerIdx >= 0 ? headerIdx : 0] ?? []
  const cols = map ?? detectColumns(header)
  if (!cols) return { rows: [], map: null, header }
  // Distinct sections may describe different accounts or repeat the same transfers.
  // Do not silently import a partial or duplicated consolidated statement.
  if (headerIdx >= 0 && all.slice(headerIdx + 1).some(r => detectColumns(r) !== null))
    return { rows: [], map: null, header, error: 'multiple_sections' }
  const rows: ImportRow[] = []
  for (const r of all.slice((headerIdx >= 0 ? headerIdx : 0) + 1)) {
    if (cols.state != null && r[cols.state] && !/completed|completat|eseguit|booked|contabilizzat/i.test(r[cols.state])) continue
    const date = parseBankDate(r[cols.date] ?? '')
    let amount: number | null = null
    if (cols.amount != null) amount = parseBankAmount(r[cols.amount] ?? '')
    else if (cols.debit != null && cols.debit === cols.credit) amount = parseBankAmount(r[cols.debit] ?? '')
    else {
      const d = cols.debit != null ? parseBankAmount(r[cols.debit] ?? '') : null
      const c = cols.credit != null ? parseBankAmount(r[cols.credit] ?? '') : null
      amount = c ? Math.abs(c) : d ? -Math.abs(d) : null
    }
    if (cols.fee != null && amount != null) amount -= Math.abs(parseBankAmount(r[cols.fee] ?? '') ?? 0)
    const description = cols.description.map(i => r[i] ?? '').filter(Boolean).join(' · ')
    if (!date || amount == null || amount === 0) continue
    rows.push({ date, description, amount: Math.round(amount * 100) / 100,
                currency: cols.currency != null ? (r[cols.currency] || null) : null })
  }
  return { rows, map: cols, header }
}
