import { describe, expect, it } from 'vitest'
import { parseConsolidated, readConsolidatedWorkbook } from './consolidatedStatement'
import * as XLSX from 'xlsx'

const csv = [
  'Deposito senza vincoli (EUR),,,,,',
  'Valore del deposito,,,,,',
  ',,Saldo di chiusura,"1.250,50€",,',
  'Conto personale (EUR),,,,,',
  'Riepilogo della transazione,,,,,',
  'Data,Descrizione,Categoria,Denaro in entrata/uscita,Saldo,Costi',
  '1 ott 2026,Bar,Spesa,"-2,50€","100,00€",',
  '2 ott 2026,A EUR Conto deposito senza vincoli,Trasferimento,"-10,00€","90,00€",',
  '3 ott 2026,Stipendio,Entrata,"1.000,00€","1090,00€",',
  'Totale,,,,,',
  'Conto personale (USD),,,,,',
  'Data,Descrizione,Categoria,Denaro in entrata/uscita,Saldo,Costi',
  '4 ott 2026,Negozio,Spesa,-5.00,100,',
].join('\n')

describe('estratto consolidato', () => {
  it('isola il conto EUR e propone il deposito separato', () => {
    const result = parseConsolidated(csv)
    expect(result?.rows).toEqual([
      { date: '2026-10-01', description: 'Bar', amount: -2.5, currency: 'EUR' },
      { date: '2026-10-03', description: 'Stipendio', amount: 1000, currency: 'EUR' },
    ])
    expect(result?.transfersExcluded).toBe(1)
    expect(result?.depositBalance).toBe(1250.5)
  })
  it('rifiuta due sezioni principali EUR', () => {
    expect(parseConsolidated(csv + '\n' + csv)).toBeNull()
  })
  it('rifiuta un importo non interpretabile', () => {
    expect(parseConsolidated(csv.replace('-2,50€', 'non valido'))).toBeNull()
  })
  it('non tronca silenziosamente la sezione davanti a una data sconosciuta', () => {
    expect(parseConsolidated(csv.replace('2 ott 2026', 'data sconosciuta'))).toBeNull()
  })
  it('interpreta il simbolo euro corrotto dalla conversione del foglio', () => {
    expect(parseConsolidated(csv.replaceAll('€', 'â‚¬'))?.rows[0].amount).toBe(-2.5)
  })
  it('legge un workbook sintetico nella struttura a una colonna', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(csv.split('\n').map(row => [row])), 'Statement')
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    expect((await readConsolidatedWorkbook(new File([bytes], 'test.xlsx')))?.rows.map(r => r.amount)).toEqual([-2.5, 1000])
  })
  it('rifiuta un workbook che dichiara un’espansione ZIP eccessiva', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(csv.split('\n').map(row => [row])), 'Statement')
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
    const view = new DataView(bytes.buffer)
    let central = -1
    for (let i = 0; i <= bytes.length - 4; i++) if (view.getUint32(i, true) === 0x02014b50) { central = i; break }
    expect(central).toBeGreaterThanOrEqual(0)
    view.setUint32(central + 24, 17 * 1024 * 1024, true)
    expect(await readConsolidatedWorkbook(new File([bytes], 'oversized.xlsx'))).toBeNull()
  })
  it('rifiuta un file che non è un archivio XLSX valido', async () => {
    expect(await readConsolidatedWorkbook(new File(['not a workbook'], 'invalid.xlsx'))).toBeNull()
  })
  it('rifiuta trasferimenti verso il deposito con segno contraddittorio', () => {
    expect(parseConsolidated(csv.replace('-10,00€', '10,00€'))).toBeNull()
  })
  it('rifiuta due righe indistinguibili invece di scartarne una', () => {
    expect(parseConsolidated(csv.replace('Totale,', '1 ott 2026,Bar,Spesa,"-2,50€","100,00€",\nTotale,'))).toBeNull()
  })
})
