// Excel generico: ogni foglio diventa un CSV, letto poi dallo stesso motore dei CSV (convenzioni, righe escluse, anteprima).
// Tutto nel telefono: il file non esce dal dispositivo. Le formule non si eseguono: si usano i valori salvati nel file,
// e un testo che comincia con «=» resta testo. Limiti di dimensione per file ostili (ZIP gonfiati, fogli enormi).
import { safeXlsxEnvelope } from './consolidatedStatement'
import { FORMULA_CELL_MARKER } from './importCsv'

export interface WorkbookSheet { name: string; csv: string }

export const WORKBOOK_LIMITS = { bytes: 5 * 1024 * 1024, sheets: 20, rows: 20000, columns: 60, cellChars: 2000 }

const pad = (n: number) => String(n).padStart(2, '0')

/** Il valore di una cella come testo non ambiguo: date in ISO, numeri con il punto decimale e senza migliaia. */
export function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : ''
  // un numero di Excel ha sempre il punto decimale: «1.234» (tre decimali) diventa «1.2340», così non sembra un migliaio
  if (typeof v === 'number') return !Number.isFinite(v) ? '' : String(v).replace(/^(-?\d+\.\d{3})$/, '$10')
  return String(v).slice(0, WORKBOOK_LIMITS.cellChars)
}

/** Righe → CSV con «;», ogni cella tra virgolette: i separatori dentro le descrizioni non spezzano le colonne. */
export function rowsToCsv(rows: unknown[][]): string {
  return rows.map(r => r.map(c => `"${cellText(c).replace(/"/g, '""').replace(/\r\n?|\n/g, ' ')}"`).join(';')).join('\n')
}

/** I fogli non vuoti di un XLSX, ciascuno come CSV. null se il file non è un XLSX valido o supera i limiti. */
export async function readWorkbookSheets(file: File): Promise<WorkbookSheet[] | null> {
  if (file.size > WORKBOOK_LIMITS.bytes) return null
  const buffer = await file.arrayBuffer()
  if (!safeXlsxEnvelope(buffer)) return null
  const XLSX = await import('xlsx')
  // SheetJS legge le formule come metadati, non le esegue. Il risultato in cache non è attendibile per l'import.
  const workbook = XLSX.read(buffer, { type: 'array', bookVBA: false, cellDates: true, cellFormula: true, cellHTML: false })
  if (!workbook.SheetNames.length || workbook.SheetNames.length > WORKBOOK_LIMITS.sheets) return null
  const out: WorkbookSheet[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name], ref = sheet?.['!ref']
    if (!ref) continue
    const range = XLSX.utils.decode_range(ref)
    if (range.e.r > WORKBOOK_LIMITS.rows || range.e.c >= WORKBOOK_LIMITS.columns) return null
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true })
    let hasContent = false
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]
      for (let ci = 0; ci < row.length; ci++) {
        const addr = XLSX.utils.encode_cell({ r: range.s.r + ri, c: range.s.c + ci })
        if (sheet[addr]?.f !== undefined) { row[ci] = FORMULA_CELL_MARKER; hasContent = true }
        else if (cellText(row[ci]).trim()) hasContent = true
      }
    }
    if (hasContent) out.push({ name: name.slice(0, 100), csv: rowsToCsv(rows) })
  }
  return out
}
