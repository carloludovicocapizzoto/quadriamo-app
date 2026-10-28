// Excel generico: ogni foglio diventa un CSV, letto poi dallo stesso motore dei CSV (convenzioni, righe escluse, anteprima).
// Tutto nel telefono: il file non esce dal dispositivo. Le formule non si eseguono, e il valore che il file ha salvato per una
// formula può essere vecchio: la cella diventa FORMULA_CELL e il motore esclude la riga, se la colonna serve, con il motivo.
// Un testo che comincia con «=» non è una formula e resta testo. Limiti di dimensione per file ostili (ZIP gonfiati, fogli enormi).
import { safeXlsxEnvelope } from './consolidatedStatement'
import { CSV_LIMITS, FORMULA_CELL } from './importCsv'

export interface WorkbookSheet { name: string; csv: string }

// gli stessi limiti dei CSV (ogni foglio diventa un CSV), più il numero di fogli
export const WORKBOOK_LIMITS = { bytes: CSV_LIMITS.bytes, sheets: 20, rows: CSV_LIMITS.records - 1, columns: CSV_LIMITS.columns, cellChars: CSV_LIMITS.cellChars }

const pad = (n: number) => String(n).padStart(2, '0')

/** Il valore di una cella come testo non ambiguo: date in ISO, numeri con il punto decimale e senza migliaia. */
export function cellText(v: unknown): string {
  if (v == null) return ''
  if (v === FORMULA_CELL) return v
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
  // cellFormula: si leggono le formule solo per riconoscerle (SheetJS non le esegue mai)
  const workbook = XLSX.read(buffer, { type: 'array', bookVBA: false, cellDates: true, cellFormula: true, cellHTML: false })
  if (!workbook.SheetNames.length || workbook.SheetNames.length > WORKBOOK_LIMITS.sheets) return null
  const out: WorkbookSheet[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name], ref = sheet?.['!ref']
    if (!ref) continue
    const range = XLSX.utils.decode_range(ref)
    if (range.e.r > WORKBOOK_LIMITS.rows || range.e.c >= WORKBOOK_LIMITS.columns) return null
    const rows: unknown[][] = []
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: unknown[] = []
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as { t?: string; v?: unknown; f?: string; F?: string } | undefined
        // f: formula della cella; F: cella dentro una formula a matrice
        row.push(!cell ? '' : cell.f || cell.F ? FORMULA_CELL : cell.t === 'e' ? '' : cell.v)
      }
      if (row.some(c => cellText(c).trim())) rows.push(row)
    }
    if (rows.some(r => r.some(c => cellText(c).trim()))) out.push({ name: name.slice(0, 100), csv: rowsToCsv(rows) })
  }
  return out
}
