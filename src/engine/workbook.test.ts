import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { CsvParseError, CSV_LIMITS, parseCsv, readStatement } from './importCsv'
import { cellText, readWorkbookSheets, rowsToCsv, WORKBOOK_LIMITS } from './workbook'
import { readConsolidatedWorkbook, UnsafeWorkbookFormulaError } from './consolidatedStatement'

const book = (sheets: Record<string, unknown[][]>) => {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), name)
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'sintetico.xlsx')
}

describe('Fase 2E: Excel generico', () => {
  it('legge tutti i fogli non vuoti, con date e numeri veri delle celle', async () => {
    const sheets = await readWorkbookSheets(book({
      Info: [['Estratto sintetico'], ['Conto QA']],
      Vuoto: [],
      Movimenti: [['Data', 'Descrizione', 'Importo'], [new Date(2026, 9, 28), 'QA Affitto, ottobre', -1234.5], [new Date(2026, 9, 29), 'QA Stipendio', 2000]],
    }))
    expect(sheets?.map(s => s.name)).toEqual(['Info', 'Movimenti'])
    const res = readStatement(sheets![1].csv)
    expect(res.rows).toEqual([
      { date: '2026-10-28', description: 'QA Affitto, ottobre', amount: -1234.5, currency: null },
      { date: '2026-10-29', description: 'QA Stipendio', amount: 2000, currency: null }])
    expect(res.skipped).toEqual([])
  })
  it('un numero con tre decimali non diventa un migliaio: per l’euro la riga è esclusa con il motivo', () => {
    expect(cellText(1.234)).toBe('1.2340')
    const res = readStatement(rowsToCsv([['Date', 'Description', 'Amount'], ['2026-10-28', 'QA', 1.234], ['2026-10-29', 'QA', 12.5]]))
    expect(res.rows.map(r => r.amount)).toEqual([12.5])
    expect(res.skipped).toEqual([{ line: 2, reason: 'precision' }])
  })
  it('un testo che comincia con «=» resta testo, non diventa una formula', () => {
    const res = readStatement(rowsToCsv([['Date', 'Description', 'Amount'], ['2026-10-28', '=HYPERLINK("x")', -1]]))
    expect(res.rows[0].description).toBe('=HYPERLINK("x")')
  })
  it('esclude i risultati in cache delle formule e distingue il testo letterale con =', async () => {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Description', 'Amount'],
      ['2026-10-28', 'QA formula con cache', -99],
      ['2026-10-29', '=HYPERLINK("x")', -2.5],
      ['2026-10-30', 'QA formula senza cache', ''],
      ['2026-10-31', 'QA numero normale', -3],
    ])
    sheet.C2 = { t: 'n', f: '1+1', v: -99 }
    sheet.C4 = { t: 'n', f: '1+1' }
    XLSX.utils.book_append_sheet(wb, sheet, 'Movimenti')
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'formule.xlsx')
    const sheets = await readWorkbookSheets(file)
    const parsed = readStatement(sheets![0].csv)
    expect(parsed.rows).toEqual([
      { date: '2026-10-29', description: '=HYPERLINK("x")', amount: -2.5, currency: null },
      { date: '2026-10-31', description: 'QA numero normale', amount: -3, currency: null },
    ])
    expect(parsed.skipped).toEqual([{ line: 2, reason: 'formula' }, { line: 4, reason: 'formula' }])
    expect(sheets![0].csv).not.toContain('-99')
  })
  it('rifiuta esplicitamente le formule anche nel foglio consolidato a colonna singola', async () => {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([['Personal Account (EUR)'], ['2026-10-28 · QA · -99,00']])
    sheet.A2 = { t: 's', f: '"2026-10-28 · QA · -99,00"', v: '2026-10-28 · QA · -99,00' }
    XLSX.utils.book_append_sheet(wb, sheet, 'Statement')
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'consolidated-formula.xlsx')
    await expect(readConsolidatedWorkbook(file)).rejects.toBeInstanceOf(UnsafeWorkbookFormulaError)
  })
  it('il parser CSV applica limiti interni a byte, righe, colonne e celle e rifiuta virgolette malformate', () => {
    expect(() => parseCsv('abc', { ...CSV_LIMITS, bytes: 2 })).toThrow(CsvParseError)
    expect(() => parseCsv('a;b\n1;2', { ...CSV_LIMITS, rows: 1 })).toThrow(CsvParseError)
    expect(() => parseCsv('a;b;c', { ...CSV_LIMITS, columns: 2 })).toThrow(CsvParseError)
    expect(() => parseCsv('abcdef', { ...CSV_LIMITS, cellChars: 5 })).toThrow(CsvParseError)
    expect(() => parseCsv('é', { ...CSV_LIMITS, bytes: 1 })).toThrow(CsvParseError)
    expect(() => parseCsv('a;b\n"bad"tail;x')).toThrow(CsvParseError)
    expect(readStatement('Date;Description;Amount\n2026-10-28;"bad"tail;-1').error).toBe('malformed')
    expect(parseCsv('a;b\n"line 1\nline 2";x')).toEqual([['a', 'b'], ['line 1\nline 2', 'x']])
  })
  it('rifiuta un file troppo grande o con troppi fogli', async () => {
    expect(await readWorkbookSheets(new File([new Uint8Array(WORKBOOK_LIMITS.bytes + 1)], 'grande.xlsx'))).toBeNull()
    const many = Object.fromEntries(Array.from({ length: WORKBOOK_LIMITS.sheets + 1 }, (_, i) => [`F${i}`, [['x']]]))
    expect(await readWorkbookSheets(book(many))).toBeNull()
    expect(await readWorkbookSheets(new File(['non è un excel'], 'finto.xlsx'))).toBeNull()
  })
})

describe('Fase 2E: colonne scelte a mano', () => {
  const csv = 'Quando;Cosa;Uscita;Entrata;Note\n28/10/2026;QA Affitto;1.234,00;;x\n29/10/2026;QA Rimborso;;12,50;y\n'
  it('un’intestazione sconosciuta non si indovina', () => {
    expect(readStatement(csv)).toMatchObject({ map: null, rows: [], header: ['Quando', 'Cosa', 'Uscita', 'Entrata', 'Note'] })
  })
  it('con le colonne indicate (uscite ed entrate separate) legge segni e importi esatti', () => {
    const res = readStatement(csv, { date: 0, description: [1], amount: null, debit: 2, credit: 3, currency: null, fee: null, state: null })
    expect(res.rows).toEqual([
      { date: '2026-10-28', description: 'QA Affitto', amount: -1234, currency: null },
      { date: '2026-10-29', description: 'QA Rimborso', amount: 12.5, currency: null }])
  })
})
