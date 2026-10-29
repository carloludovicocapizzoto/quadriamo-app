import { describe, expect, it } from 'vitest'
import { parseCsv, readStatement } from './importCsv'

// Regressione Fase 2E: righe descrittive prima delle intestazioni (titolo, conto, periodo) con virgole o punti e virgola.
describe('Fase 2E: CSV con righe descrittive prima delle intestazioni', () => {
  it('il separatore si decide sulle righe della tabella, non sulla prima riga', () => {
    const csv = 'Estratto conto sintetico, conto QA, ottobre 2026\nData;Descrizione;Importo\n28/10/2026;QA Affitto, ottobre;-1.234,50\n29/10/2026;QA Stipendio;2.000,00\n'
    expect(parseCsv(csv)[1]).toEqual(['Data', 'Descrizione', 'Importo'])
    const res = readStatement(csv)
    expect(res.rows).toEqual([
      { date: '2026-10-28', description: 'QA Affitto, ottobre', amount: -1234.5, currency: null },
      { date: '2026-10-29', description: 'QA Stipendio', amount: 2000, currency: null }])
    expect(res.skipped).toEqual([])
  })
  it('anche con più righe descrittive e il punto e virgola nel titolo di un CSV con virgole', () => {
    const csv = 'Synthetic bank; QA account\nPeriod: Oct 1 - Oct 31; 2026\n\nDate,Description,Amount\n2026-10-28,QA Rent,-1234.50\n2026-10-29,QA Salary,2000.00\n2026-10-30,QA Coffee,-3.20\n'
    const res = readStatement(csv)
    expect(res.rows.map(r => r.amount)).toEqual([-1234.5, 2000, -3.2])
    expect(res.skipped).toEqual([])
  })
  it('con colonne sconosciute, l’intestazione proposta è la prima riga della tabella, non il titolo', () => {
    const csv = 'Estratto sintetico del conto QA\nPeriodo ottobre 2026\nQuando;Cosa;Uscita;Entrata\n28/10/2026;QA Affitto;1.234,00;\n29/10/2026;QA Rimborso;;12,50\n'
    expect(readStatement(csv).header).toEqual(['Quando', 'Cosa', 'Uscita', 'Entrata'])
  })
})
