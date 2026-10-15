// Import degli estratti conto in CSV (Revolut, N26 e formati generici delle banche).
// Restituisce righe "grezze": data, descrizione, importo con segno (negativo = uscita), valuta.

export interface ImportRow { date: string; description: string; amount: number; currency: string | null }

export interface ColumnMap { date: number; description: number[]; amount: number | null; debit: number | null; credit: number | null;
  currency: number | null; fee: number | null; state: number | null }

/** Divide un CSV in righe e celle, rispettando le virgolette. Riconosce il separatore (, ; o tab). */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const first = clean.split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map(d => [d, first.split(d).length] as const)
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
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

/** Importo bancario -> numero con segno ("-1.234,56", "1,234.56", "−12,00 €"). */
export function parseBankAmount(s: string): number | null {
  let t = s.replace(/[\s€$£]|EUR|USD|GBP|CHF/g, '').replace('−', '-')
  if (!t) return null
  const neg = t.startsWith('-') || (t.startsWith('(') && t.endsWith(')'))
  t = t.replace(/[-+()]/g, '')
  const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.')
  if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (lc > -1) t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

/** Trasforma il CSV in righe pronte per la casella "Da confermare". */
export function readStatement(text: string, map?: ColumnMap): { rows: ImportRow[]; map: ColumnMap | null; header: string[] } {
  const all = parseCsv(text)
  const headerIdx = all.findIndex(r => detectColumns(r) != null)
  const header = all[headerIdx >= 0 ? headerIdx : 0] ?? []
  const cols = map ?? detectColumns(header)
  if (!cols) return { rows: [], map: null, header }
  const rows: ImportRow[] = []
  for (const r of all.slice((headerIdx >= 0 ? headerIdx : 0) + 1)) {
    if (cols.state != null && r[cols.state] && !/completed|completat|eseguit|booked|contabilizzat/i.test(r[cols.state])) continue
    const date = parseBankDate(r[cols.date] ?? '')
    let amount: number | null = null
    if (cols.amount != null) amount = parseBankAmount(r[cols.amount] ?? '')
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
