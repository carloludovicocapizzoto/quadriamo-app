import { describe, expect, it } from 'vitest'
import { defaultSettings, parseBankAmount, parseBankDate, readStatement } from '.'
import { toCsv } from '../store/backup'

describe('CSV: dati e delimitatori validi', () => {
  it('conserva il segno di una colonna unica entrata/uscita', () => {
    const csv = 'Data,Descrizione,Categoria,Denaro in entrata/uscita,Saldo\n01/10/2026,Spesa sintetica,Altro,-2.50,100\n02/10/2026,Entrata sintetica,Altro,3.00,103'
    expect(readStatement(csv).rows.map(r => r.amount)).toEqual([-2.5, 3])
  })
  it('rifiuta estratti con più sezioni interpretabili come movimenti', () => {
    const csv = 'Data,Descrizione,Denaro in entrata/uscita\n01/10/2026,Spesa,-2.50\nData,Descrizione,Denaro in entrata/uscita\n02/10/2026,Altra,-1.00'
    expect(readStatement(csv)).toMatchObject({ rows: [], error: 'multiple_sections' })
  })
  it('rifiuta un file con un campo tra virgolette non chiuso', () => {
    expect(readStatement('Date,Amount,Description\n2026-10-17,-10,"Coffee').rows).toEqual([])
  })
  it.each(['12,34.56', '1.23,45', '1,2.345,67'])('rifiuta il raggruppamento non valido %s', raw => {
    expect(parseBankAmount(raw)).toBeNull()
  })
  it.each([['.50', 0.5], ['12.', 12], ['+1.234,56', 1234.56], ['−12,00 €', -12], ['1\u202f234,56', 1234.56]])('mantiene il formato valido %s', (raw, expected) => {
    expect(parseBankAmount(raw)).toBe(expected)
  })
  it.each(['2026-02-31', '31/04/2026', '29/02/2026', '00/10/2026', '12/13/2026', '2026-10-170', '2026-10-17junk'])('rifiuta la data impossibile %s', raw => {
    expect(parseBankDate(raw)).toBeNull()
  })
  it.each([['29/02/2028', '2028-02-29'], ['2026-10-17T09:00:00Z', '2026-10-17'], ['3.4.26', '2026-04-03']])('mantiene la data valida %s', (raw, expected) => {
    expect(parseBankDate(raw)).toBe(expected)
  })
  it.each([['Oct 01, 2026', '2026-10-01'], ['January 2, 2026', '2026-01-02'], ['Dec 31, 2026', '2026-12-31']])('legge le date inglesi %s', (raw, expected) => {
    expect(parseBankDate(raw)).toBe(expected)
  })
  it.each(['Feb 31, 2026', 'Foo 01, 2026', 'Oct 1 2026'])('rifiuta le date inglesi non valide %s', raw => {
    expect(parseBankDate(raw)).toBeNull()
  })
  it.each(['--12', '1-2', '-+12', '(12', '12)', '1e3', '0x10', '12,3,4', '12.34.56'])('rifiuta l’importo malformato %s', raw => {
    expect(parseBankAmount(raw)).toBeNull()
  })
  it('non importa righe con date e importi non validi', () => {
    expect(readStatement('Date,Description,Amount\n2026-02-31,Invalid,-10\n2026-10-17,Invalid,1-2\n2026-10-17,Valid,-12.50').rows)
      .toEqual([{ date: '2026-10-17', description: 'Valid', amount: -12.5, currency: null }])
  })
  it('ignora i delimitatori dentro le intestazioni tra virgolette', () => {
    expect(readStatement('Date;Description;"Amount (EUR, USD, GBP, CHF)"\r\n17/10/2026;Coffee;-2,50').rows)
      .toEqual([{ date: '2026-10-17', description: 'Coffee', amount: -2.5, currency: null }])
  })
  it('esporta e rilegge virgole, virgolette e tutti i ritorni a capo', () => {
    for (const description of ['One\rTwo', 'One\nTwo', 'One\r\nTwo', 'One,"Two";Three']) {
      const csv = toCsv({ version: 1, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }), transactions: [{ id: 'a', date: '2026-10-17', category: 'groceries', amount: -12.5, description }] }, { category: () => 'Food', bucket: () => '' })
      expect(readStatement(csv).rows).toEqual([{ date: '2026-10-17', description, amount: -12.5, currency: 'EUR' }])
    }
  })
})
