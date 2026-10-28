import { isIsoDate } from './dates'
import { parseBankAmount, parseCsv, type ImportRow } from './importCsv'
import { normalize } from './rules'

export interface ConsolidatedPreview { rows: ImportRow[]; depositBalance: number | null; transfersExcluded: number }

const label = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const months: Record<string, string> = { gen:'01', feb:'02', mar:'03', apr:'04', mag:'05', giu:'06', lug:'07', ago:'08', set:'09', ott:'10', nov:'11', dic:'12' }
function italianDate(s: string): string | null {
  const m = s.trim().toLowerCase().match(/^(\d{1,2})\s+([a-z]{3})\.?\s+(\d{4})$/)
  if (!m || !months[m[2]]) return null
  const iso = `${m[3]}-${months[m[2]]}-${m[1].padStart(2, '0')}`
  return isIsoDate(iso) ? iso : null
}

/** Bound ZIP expansion before handing an untrusted workbook to SheetJS. Reject ZIP64/multi-disk/encrypted files. */
function safeXlsxEnvelope(buffer: ArrayBuffer): boolean {
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

/** Strictly supported Italian consolidated statement; rejects ambiguity instead of importing partial data. */
export function parseConsolidated(text: string): ConsolidatedPreview | null {
  const all = parseCsv(text)
  const personal = all.flatMap((r, i) => label(r[0] ?? '') === 'conto personale (eur)' ? [i] : [])
  const candidates = personal.filter(i => all.slice(i + 1, i + 8).some(r => label(r[0] ?? '') === 'data' && label(r[1] ?? '') === 'descrizione' && label(r[3] ?? '') === 'denaro in entrata/uscita'))
  if (candidates.length !== 1) return null
  const start = candidates[0]; const offset = all.slice(start + 1, start + 8).findIndex(r => label(r[0] ?? '') === 'data' && label(r[1] ?? '') === 'descrizione' && label(r[3] ?? '') === 'denaro in entrata/uscita')
  const header = start + 1 + offset; const rows: ImportRow[] = []; let transfersExcluded = 0; let finished = false
  for (const r of all.slice(header + 1)) {
    const first = (r[0] ?? '').trim()
    if (!first) continue
    const date = italianDate(first)
    if (!date) {
      if (label(first) === 'totale' && (rows.length || transfersExcluded)) { finished = true; break }
      return null
    }
    const amount = parseBankAmount(r[3] ?? '')
    if (amount == null || amount === 0 || !(r[1] ?? '').trim()) return null
    const transfer = label(r[1]).match(/^(a|da) eur conto deposito senza vincoli$/)
    if (transfer) {
      if ((transfer[1] === 'a' && amount >= 0) || (transfer[1] === 'da' && amount <= 0)) return null
      transfersExcluded++; continue
    }
    rows.push({ date, description: r[1].trim(), amount: Math.round(amount * 100) / 100, currency: 'EUR' })
  }
  if (!finished || !rows.length) return null
  // The existing import ledger collapses identical fingerprints; refuse ambiguous
  // same-day transactions rather than silently discarding a legitimate movement.
  const fingerprints = rows.map(r => `${r.date}|${r.amount.toFixed(2)}|${normalize(r.description)}`)
  if (new Set(fingerprints).size !== fingerprints.length) return null
  const deposits = all.flatMap((r, i) => label(r[0] ?? '') === 'deposito senza vincoli (eur)' ? [i] : [])
  const balances = deposits.flatMap(i => {
    const value = all.slice(i + 1, i + 25); const marker = value.findIndex(r => label(r[0] ?? '') === 'valore del deposito')
    if (marker < 0) return []
    return value.slice(marker + 1).flatMap(r => label(r[2] ?? '') === 'saldo di chiusura' ? [parseBankAmount(r[3] ?? '')] : [])
  })
  if (balances.length > 1 || balances.some(x => x == null || x < 0)) return null
  return { rows, depositBalance: balances[0] ?? null, transfersExcluded }
}

/** Local-only parse; does not upload the spreadsheet. Limits size and rejects unexpected workbook layout. */
export async function readConsolidatedWorkbook(file: File): Promise<ConsolidatedPreview | null> {
  if (file.size > 5 * 1024 * 1024) return null
  const buffer = await file.arrayBuffer()
  if (!safeXlsxEnvelope(buffer)) return null
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array', bookVBA: false })
  if (workbook.SheetNames.length !== 1) return null
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const ref = sheet['!ref']; if (!ref) return null
  const range = XLSX.utils.decode_range(ref)
  if (range.e.c !== 0 || range.e.r > 20000) return null
  const cells = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  return parseConsolidated(cells.map(r => String(r[0] ?? '')).join('\n'))
}
