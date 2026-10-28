import { isIsoDate } from './dates'
import { parseMoney, type DecimalMark } from './bankNumbers'
import { parseBankDate, parseCsv, type ImportRow } from './importCsv'
import { normalize } from './rules'

export interface ConsolidatedPreview {
  rows: ImportRow[]
  depositBalance: number | null
  transfersExcluded: number
  periodStart: string
  periodEnd: string
  repeatedRows: number
}

export class UnsafeWorkbookFormulaError extends Error {
  constructor() { super('Workbook contains a formula in a financial field'); this.name = 'UnsafeWorkbookFormulaError' }
}

const label = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
/** I due tracciati hanno una convenzione nota (italiano «1.000,00€», inglese «1,000.00»): niente da indovinare. */
const amountIn = (raw: string, mark: DecimalMark) => { const m = parseMoney(raw, mark); return m.ok ? m.value : null }
const months: Record<string, string> = { gen:'01', feb:'02', mar:'03', apr:'04', mag:'05', giu:'06', lug:'07', ago:'08', set:'09', ott:'10', nov:'11', dic:'12' }
function italianDate(s: string): string | null {
  const m = s.trim().toLowerCase().match(/^(\d{1,2})\s+([a-z]{3})\.?\s+(\d{4})$/)
  if (!m || !months[m[2]]) return null
  const iso = `${m[3]}-${months[m[2]]}-${m[1].padStart(2, '0')}`
  return isIsoDate(iso) ? iso : null
}

/** Bound ZIP expansion before handing an untrusted workbook to SheetJS. Reject ZIP64/multi-disk/encrypted files. */
export function safeXlsxEnvelope(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer)
  const min = Math.max(0, bytes.length - 65_557)
  let end = -1
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  }
  if (end < 0) return false
  const disk = view.getUint16(end + 4, true), centralDisk = view.getUint16(end + 6, true)
  const diskEntries = view.getUint16(end + 8, true), entries = view.getUint16(end + 10, true)
  const centralSize = view.getUint32(end + 12, true), centralOffset = view.getUint32(end + 16, true)
  const commentLength = view.getUint16(end + 20, true)
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entries || entries === 0 || entries > 256 || entries === 0xffff ||
      centralSize === 0xffffffff || centralOffset === 0xffffffff || end + 22 + commentLength !== bytes.length ||
      centralOffset + centralSize !== end) return false
  let at = centralOffset, expanded = 0
  for (let i = 0; i < entries; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) return false
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true)
    const compressed = view.getUint32(at + 20, true), uncompressed = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true), extraLength = view.getUint16(at + 30, true)
    const entryCommentLength = view.getUint16(at + 32, true), startDisk = view.getUint16(at + 34, true)
    const localOffset = view.getUint32(at + 42, true), entryEnd = at + 46 + nameLength + extraLength + entryCommentLength
    if (entryEnd > end || startDisk !== 0 || (flags & 1) !== 0 || (method !== 0 && method !== 8) ||
        compressed === 0xffffffff || uncompressed === 0xffffffff || localOffset === 0xffffffff ||
        uncompressed > 16 * 1024 * 1024 || compressed === 0 && uncompressed > 0) return false
    expanded += uncompressed
    if (expanded > 32 * 1024 * 1024 || localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== 0x04034b50) return false
    const localName = view.getUint16(localOffset + 26, true), localExtra = view.getUint16(localOffset + 28, true)
    if (view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method ||
        localOffset + 30 + localName + localExtra + compressed > centralOffset) return false
    at = entryEnd
  }
  return at === end
}

type StatementFormat = 'italian' | 'english'
interface StatementTable { marker: number; header: number; format: StatementFormat }

function tableHeader(row: string[]): StatementFormat | null {
  if (label(row[0] ?? '') === 'data' && label(row[1] ?? '') === 'descrizione' && label(row[3] ?? '') === 'denaro in entrata/uscita') return 'italian'
  if (label(row[0] ?? '') === 'date' && label(row[1] ?? '') === 'description' && label(row[3] ?? '') === 'money in/out' && label(row[4] ?? '') === 'balance') return 'english'
  return null
}

/** Only exclude clearly labelled internal transfers, and reject a sign that contradicts their direction. */
function internalTransfer(description: string, format: StatementFormat): 'out' | 'in' | null {
  const d = label(description)
  if (format === 'italian') {
    const m = d.match(/^(a|da) eur conto deposito senza vincoli$/)
    return m ? (m[1] === 'a' ? 'out' : 'in') : null
  }
  const m = d.match(/^(to|from)\s+(instant access savings|pocket)\b/)
  return m ? (m[1] === 'to' ? 'out' : 'in') : null
}

function extractDepositBalance(all: string[][], before: number): number | null {
  const summaries = all.flatMap((r, i) => i < before && label(r[0] ?? '') === 'savings accounts summaries' ? [i] : [])
  if (summaries.length !== 1) return null
  const details = all.flatMap((r, i) => i > summaries[0] && i < before && label(r[0] ?? '') === 'savings account details' ? [i] : [])
  if (details.length !== 1) return null
  const products = all.flatMap((r, i) => i > summaries[0] && i < details[0] && /^instant access savings\s*\(eur\)$/.test(label(r[0] ?? '')) ? [i] : [])
  if (products.length !== 1) return null
  const balances = all.slice(details[0] + 1, before).filter(r => label(r[2] ?? '') === 'closing balance')
    .map(r => amountIn(r[3] ?? '', '.'))
  return balances.length === 1 && balances[0] != null && balances[0] >= 0 ? balances[0] : null
}

function extractItalianDepositBalance(all: string[][], before: number): number | null {
  const deposits = all.flatMap((r, i) => i < before && label(r[0] ?? '') === 'deposito senza vincoli (eur)' ? [i] : [])
  const balances = deposits.flatMap(i => {
    const value = all.slice(i + 1, Math.min(before, i + 25)); const marker = value.findIndex(r => label(r[0] ?? '') === 'valore del deposito')
    if (marker < 0) return []
    return value.slice(marker + 1).flatMap(r => label(r[2] ?? '') === 'saldo di chiusura' ? [amountIn(r[3] ?? '', ',')] : [])
  })
  return balances.length === 1 && balances[0] != null && balances[0] >= 0 ? balances[0] : null
}

/** Supports the existing Italian export and the multi-section English Revolut consolidated CSV.
 * Selects exactly one personal EUR transaction table and rejects partial or ambiguous statements. */
export function parseConsolidated(text: string): ConsolidatedPreview | null {
  let all: string[][]
  try { all = parseCsv(text) } catch { return null }
  const markers = all.flatMap((r, i) => ['conto personale (eur)', 'personal account (eur)'].includes(label(r[0] ?? '')) ? [i] : [])
  const tables: StatementTable[] = []
  for (const marker of markers) {
    const header = all.findIndex((r, i) => i > marker && i <= marker + 15 && tableHeader(r) != null)
    if (header >= 0) tables.push({ marker, header, format: tableHeader(all[header])! })
  }
  if (tables.length !== 1) return null
  const table = tables[0], rows: ImportRow[] = []
  let transfersExcluded = 0, finished = false
  for (const r of all.slice(table.header + 1)) {
    const first = (r[0] ?? '').trim()
    if (!first) continue
    if (label(first) === 'totale' || label(first) === 'total') { finished = rows.length + transfersExcluded > 0; break }
    const date = table.format === 'italian' ? italianDate(first) : parseBankDate(first)
    if (!date) return null
    const amount = amountIn(r[3] ?? '', table.format === 'italian' ? ',' : '.'), description = (r[1] ?? '').trim()
    if (amount == null || amount === 0 || !description) return null
    const transfer = internalTransfer(description, table.format)
    if (transfer) {
      if ((transfer === 'out' && amount >= 0) || (transfer === 'in' && amount <= 0)) return null
      transfersExcluded++; continue
    }
    rows.push({ date, description, amount, currency: 'EUR' })
  }
  if (!finished || !rows.length) return null
  const occurrenceCounts = new Map<string, number>()
  let repeatedRows = 0
  for (const r of rows) {
    const key = `${r.date}|${r.amount.toFixed(2)}|${normalize(r.description)}`
    const count = (occurrenceCounts.get(key) ?? 0) + 1
    occurrenceCounts.set(key, count)
    if (count > 1) repeatedRows++
  }
  const dates = rows.map(r => r.date).sort()
  const depositBalance = table.format === 'english'
    ? extractDepositBalance(all, table.header)
    : extractItalianDepositBalance(all, table.header)
  return { rows, depositBalance, transfersExcluded, periodStart: dates[0], periodEnd: dates.at(-1)!, repeatedRows }
}

/** Local-only parse; does not upload the spreadsheet. Limits size and rejects unexpected workbook layout. */
export async function readConsolidatedWorkbook(file: File): Promise<ConsolidatedPreview | null> {
  if (file.size > 5 * 1024 * 1024) return null
  const buffer = await file.arrayBuffer()
  if (!safeXlsxEnvelope(buffer)) return null
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array', bookVBA: false, cellFormula: true })
  if (workbook.SheetNames.length !== 1) return null
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const ref = sheet['!ref']; if (!ref) return null
  const range = XLSX.utils.decode_range(ref)
  if (range.e.c !== 0 || range.e.r > 20000) return null
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: range.s.c })]
    if (cell?.f !== undefined) throw new UnsafeWorkbookFormulaError()
  }
  const cells = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  return parseConsolidated(cells.map(r => String(r[0] ?? '')).join('\n'))
}
