import { describe, expect, it } from 'vitest'
import { CSV_LIMITS, parseCsv, readCsv, readStatement, type ColumnMap } from './importCsv'

// Regressioni dalla review indipendente (Codex) sulla PR #11. Solo dati sintetici.
const DC: ColumnMap = { date: 0, description: [1], amount: null, debit: 2, credit: 3, currency: 4, fee: null, state: null }

describe('P2.1: dare e avere', () => {
  const csv = (...rows: string[]) => ['Data;Descrizione;Dare;Avere;Valuta', ...rows].join('\n')
  it('riproduzione: dare 10 e avere 20 sulla stessa riga non diventa un’entrata di 20; la riga è esclusa con il motivo', () => {
    const res = readStatement(csv('28/10/2026;QA Entrambi;10,00;20,00;EUR', '29/10/2026;QA Solo dare;10,00;;EUR'), DC)
    expect(res.rows).toEqual([{ date: '2026-10-29', description: 'QA Solo dare', amount: -10, currency: 'EUR' }])
    expect(res.skipped).toEqual([{ line: 2, reason: 'both' }])
  })
  it.each([
    ['solo dare', '10,00;', -10], ['solo avere', ';20,00', 20], ['dare con il segno meno', '-10,00;', -10],
    ['avere con il segno più', ';+20,00', 20], ['dare e avere zero', '0,00;0,00', 'zero'], ['entrambi vuoti', ';', 'zero'],
    ['dare zero e avere valorizzato', '0,00;20,00', 20], ['dare valorizzato e avere zero', '10,00;0', -10],
    ['entrambi valorizzati', '10,00;20,00', 'both'], ['entrambi con il segno', '-10,00;-20,00', 'both'],
  ] as const)('%s', (_, cells, want) => {
    const res = readStatement(csv(`28/10/2026;QA;${cells};EUR`, '29/10/2026;QA Riferimento;1.234,56;;EUR'), DC)
    if (typeof want === 'number') expect(res.rows[0]).toMatchObject({ amount: want })
    else expect(res.skipped).toEqual([{ line: 2, reason: want }])
  })
  it('valute diverse: le cifre della valuta di ogni riga', () => {
    const res = readStatement(csv('28/10/2026;QA KWD;1,234;;KWD', '29/10/2026;QA JPY;;500;JPY', '30/10/2026;QA JPY due;1,5;2;JPY', '31/10/2026;QA KWD entrambi;1,234;2,000;KWD'),
      DC, { mark: ',' })
    expect(res.rows.map(r => [r.currency, r.amount])).toEqual([['KWD', -1.234], ['JPY', 500]])
    expect(res.skipped).toEqual([{ line: 4, reason: 'precision' }, { line: 5, reason: 'both' }])
  })
})

describe('P2.2: limiti dei CSV generici, anche chiamando il motore direttamente', () => {
  const head = 'Data;Descrizione;Importo'
  const line = (i: number) => `28/10/2026;QA ${i};-1,00`
  it('al limite si legge; un record in più, una colonna in più, una cella troppo lunga o un testo troppo lungo: rifiutato', () => {
    const ok = [head, ...Array.from({ length: CSV_LIMITS.records - 1 }, (_, i) => line(i))].join('\n')
    expect(readStatement(ok).rows).toHaveLength(CSV_LIMITS.records - 1)
    expect(readStatement(ok + '\n' + line(0))).toMatchObject({ error: 'too_large', rows: [], skipped: [] })
    const wide = (n: number) => [Array.from({ length: n }, (_, i) => `C${i}`).join(';'), Array.from({ length: n }, () => '1').join(';')].join('\n')
    expect(parseCsv(wide(CSV_LIMITS.columns))).toHaveLength(2)
    expect(readCsv(wide(CSV_LIMITS.columns + 1)).error).toBe('too_large')
    expect(readCsv(`${head}\n28/10/2026;${'x'.repeat(CSV_LIMITS.cellChars)};-1`).error).toBeUndefined()
    expect(readStatement(`${head}\n28/10/2026;${'x'.repeat(CSV_LIMITS.cellChars + 1)};-1`).error).toBe('too_large')
    expect(readStatement(head + '\n' + ' '.repeat(CSV_LIMITS.chars))).toMatchObject({ error: 'too_large', rows: [] })
  })
  it('una cella tra virgolette su più righe conta come un record, e la sua lunghezza conta tutta', () => {
    const multi = `${head}\n28/10/2026;"QA riga uno\nriga due";-1,00\n29/10/2026;QA;-2,00`
    expect(readStatement(multi).rows.map(r => r.description)).toEqual(['QA riga uno\nriga due', 'QA'])
    const long = `${head}\n28/10/2026;"${'x\n'.repeat(CSV_LIMITS.cellChars / 2)}y";-1,00`
    expect(readCsv(long).error).toBe('too_large')
    // virgolette mai chiuse: nessuna riga, come prima
    expect(parseCsv(`${head}\n28/10/2026;"QA;-1,00`)).toEqual([])
  })
})
