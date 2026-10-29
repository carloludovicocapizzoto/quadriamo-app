import { describe, expect, it } from 'vitest'
import { amountClue, detectDateOrder, detectDecimalMark, minorDigits, parseDateWith, parseMoney } from './bankNumbers'
import { readStatement } from './importCsv'
import { parseAmount } from '../ui/kit/amount'

// Matrice della Fase 2E: cosa dice ogni testo sulla convenzione, e il valore con ciascuna convenzione.
// «x» = errore controllato (formato, raggruppamento o precisione), mai un valore inventato.
const MATRIX: [string, 'dot' | 'comma' | 'ambiguous' | 'none', number | 'x', number | 'x'][] = [
  // testo,          indizio,      con «.» decimale, con «,» decimale
  ['0', 'none', 0, 0],
  ['0,01', 'comma', 'x', 0.01],
  ['0.01', 'dot', 0.01, 'x'],
  ['0,10', 'comma', 'x', 0.1],
  ['0.10', 'dot', 0.1, 'x'],
  ['0,123', 'comma', 'x', 'x'],           // non può essere un gruppo: è un decimale, e per EUR ha troppe cifre
  ['0.123', 'dot', 'x', 'x'],
  ['1,23', 'comma', 'x', 1.23],
  ['1.23', 'dot', 1.23, 'x'],
  ['1.234', 'ambiguous', 'x', 1234],
  ['1,234', 'ambiguous', 1234, 'x'],
  ['-1.234', 'ambiguous', 'x', -1234],
  ['-1,234', 'ambiguous', -1234, 'x'],
  ['1.234,56', 'comma', 'x', 1234.56],
  ['1,234.56', 'dot', 1234.56, 'x'],
  ['1.234.567', 'comma', 'x', 1234567],
  ['1,234,567', 'dot', 1234567, 'x'],
  ['1 234,56', 'comma', 'x', 1234.56],
  ['1 234,56', 'comma', 'x', 1234.56],
  ['(1,234.56)', 'dot', -1234.56, 'x'],
  ['12.345.678,90', 'comma', 'x', 12345678.9],
  ['12,345,678.90', 'dot', 12345678.9, 'x'],
]

describe('Fase 2E: importi bancari', () => {
  it.each(MATRIX)('%s: indizio %s, «.» → %s, «,» → %s', (raw, clue, withDot, withComma) => {
    const c = amountClue(raw)
    expect(c.kind === 'decimal' ? (c.mark === '.' ? 'dot' : 'comma') : c.kind).toBe(clue)
    const dot = parseMoney(raw, '.'), comma = parseMoney(raw, ',')
    expect(dot.ok ? dot.value : 'x').toBe(withDot)
    expect(comma.ok ? comma.value : 'x').toBe(withComma)
  })
  it.each(['', '   ', 'abc', '1e3', '0x10', '--12', '12,3,4', '1.23,45', '1,2.345,67', '12-3'])('rifiuta il testo non valido «%s»', raw => {
    expect(parseMoney(raw, ',').ok).toBe(false)
    expect(parseMoney(raw, '.').ok).toBe(false)
  })
  it('rifiuta importi enormi invece di perdere cifre', () => {
    expect(parseMoney('9.999.999.999.999,00', ',')).toEqual({ ok: false, reason: 'range' })
  })
  it('non produce «-0» e legge il meno finale e quello tipografico', () => {
    expect(parseMoney('-0,00', ',')).toEqual({ ok: true, minor: 0, value: 0 })
    expect(parseMoney('1.234,56-', ',')).toMatchObject({ value: -1234.56 })
    expect(parseMoney('−12,00 €', ',')).toMatchObject({ value: -12 })
    expect(parseMoney('EUR 1.234,56', ',')).toMatchObject({ value: 1234.56 })
  })
  it('rispetta le cifre decimali della valuta', () => {
    expect(minorDigits('EUR')).toBe(2); expect(minorDigits('JPY')).toBe(0); expect(minorDigits('KWD')).toBe(3)
    expect(parseMoney('1.234', '.', minorDigits('KWD'))).toMatchObject({ minor: 1234, value: 1.234 })
    expect(parseMoney('1,5', ',', minorDigits('JPY'))).toEqual({ ok: false, reason: 'precision' })
  })
  it('decide la convenzione sul file, non riga per riga', () => {
    expect(detectDecimalMark(['-1.234', '12,50'])).toMatchObject({ mark: ',', ambiguous: false })
    expect(detectDecimalMark(['-1,234', '12.50'])).toMatchObject({ mark: '.' })
    expect(detectDecimalMark(['-1.234', '-1,234'])).toMatchObject({ mark: null, ambiguous: true })
    expect(detectDecimalMark(['1.234,56', '1,234.56'])).toMatchObject({ mark: null, conflicting: true })
    expect(detectDecimalMark(['12', '300'])).toMatchObject({ mark: null, ambiguous: false, conflicting: false })
  })
})

describe('Fase 2E: date bancarie', () => {
  it('ricava l’ordine giorno/mese dalle righe non ambigue', () => {
    expect(detectDateOrder(['03/04/2026', '28/10/2026'])).toMatchObject({ order: 'dmy' })
    expect(detectDateOrder(['03/04/2026', '10/28/2026'])).toMatchObject({ order: 'mdy' })
    expect(detectDateOrder(['03/04/2026', '05/06/2026'])).toMatchObject({ order: null, ambiguous: true })
    expect(detectDateOrder(['13/01/2026', '01/13/2026'])).toMatchObject({ conflicting: true })
  })
  it('non presume il 3 aprile per «03/04/2026» senza convenzione', () => {
    expect(parseDateWith('03/04/2026', null)).toBeNull()
    expect(parseDateWith('03/04/2026', 'dmy')).toBe('2026-04-03')
    expect(parseDateWith('03/04/2026', 'mdy')).toBe('2026-03-04')
  })
  it.each([['2026-10-28', '2026-10-28'], ['2026-10-28T09:30:00+02:00', '2026-10-28'], ['1 ott 2026', '2026-10-01'], ['Oct 1, 2026', '2026-10-01'],
    ['1 octobre 2026', '2026-10-01'], ['1 de octubre de 2026', '2026-10-01'], ['01-Oct-2026', '2026-10-01'], ['29 févr. 2028', '2028-02-29'], ['28.10.26', '2026-10-28']])(
    'legge %s', (raw, expected) => { expect(parseDateWith(raw, raw === '28.10.26' ? null : 'dmy')).toBe(expected) })
  it.each(['31/04/2026', '29/02/2027', '2026-02-30', '00/10/2026', '1 foo 2026'])('rifiuta la data impossibile %s', raw => {
    expect(parseDateWith(raw, 'dmy')).toBeNull()
  })
})

describe('Fase 2E: bug riprodotti nell’importazione CSV', () => {
  it('«-1.234» in un file italiano vale −1.234 €, non −1,23 €', () => {
    const csv = 'Data;Descrizione;Importo\n28/10/2026;Affitto;-1.234\n29/10/2026;Caffè;-1,50\n'
    expect(readStatement(csv).rows.map(r => r.amount)).toEqual([-1234, -1.5])
  })
  it('un file senza indizi non si importa da solo: chiede la convenzione', () => {
    const res = readStatement('Data;Descrizione;Importo\n28/10/2026;A;-1.234\n29/10/2026;B;-1,234\n')
    expect(res.rows).toEqual([])
    expect(res.needs?.number?.samples).toEqual(['-1.234', '-1,234'])
  })
  it('con la convenzione scelta, le righe incompatibili sono escluse con il motivo', () => {
    const res = readStatement('Data;Descrizione;Importo\n28/10/2026;A;-1.234\n29/10/2026;B;-1,234\n', undefined, { mark: ',' })
    expect(res.rows.map(r => r.amount)).toEqual([-1234])
    expect(res.skipped).toEqual([{ line: 3, reason: 'precision' }])
  })
  it('«1.234.567» non sparisce', () => {
    expect(readStatement('Data;Descrizione;Importo\n28/10/2026;Casa;1.234.567\n').rows.map(r => r.amount)).toEqual([1234567])
  })
  it('legge un CSV americano con virgole e date mese/giorno', () => {
    const csv = 'Date,Description,Amount\n10/28/2026,Rent,"-1,234.00"\n10/29/2026,"Coffee, large",-4.50\n'
    expect(readStatement(csv).rows).toEqual([
      { date: '2026-10-28', description: 'Rent', amount: -1234, currency: null },
      { date: '2026-10-29', description: 'Coffee, large', amount: -4.5, currency: null }])
  })
  it('legge un CSV francese con spazi nelle migliaia', () => {
    const csv = 'Date;Libellé;Montant\n28/10/2026;Loyer;-1 234,56\n29/10/2026;Café;-2,10\n'
    expect(readStatement(csv).rows.map(r => r.amount)).toEqual([-1234.56, -2.1])
  })
  it('chiede l’ordine delle date quando tutte sono ambigue, e non scarta in silenzio', () => {
    // intestazione inglese: USA (mese/giorno) o Regno Unito (giorno/mese), non si sa
    const res = readStatement('Date;Description;Amount\n03/04/2026;A;-1,50\n05/06/2026;B;-2,50\n')
    expect(res.rows).toEqual([])
    expect(res.needs?.date?.samples).toEqual(['03/04/2026', '05/06/2026'])
    expect(readStatement('Date;Description;Amount\n03/04/2026;A;-1,50\n', undefined, { order: 'mdy' }).rows[0].date).toBe('2026-03-04')
    // intestazione italiana (o francese, spagnola, tedesca): giorno/mese è certo
    expect(readStatement('Data;Descrizione;Importo\n03/04/2026;A;-1,50\n').rows[0].date).toBe('2026-04-03')
  })
  it('riporta le righe escluse con riga e motivo, anche totali e date impossibili', () => {
    const csv = 'Data;Descrizione;Importo\n28/10/2026;A;-1,50\n31/02/2026;B;-2,00\n29/10/2026;C;abc\nTotale;;-3,50\n'
    const res = readStatement(csv)
    expect(res.rows.map(r => r.description)).toEqual(['A'])
    expect(res.skipped).toEqual([{ line: 3, reason: 'date' }, { line: 4, reason: 'amount' }, { line: 5, reason: 'summary' }])
  })
})

describe('Fase 2E: importi scritti a mano', () => {
  it.each([
    // testo, lingua, valore (null = rifiutato, mai trasformato)
    ['0,123', 'it', null], ['0,12', 'it', 0.12], ['12.50', 'it', 12.5], ['1.234', 'it', 1234], ['1,234', 'it', null], ['1.234,56', 'it', 1234.56],
    ['0,123', 'en', null], ['1,234', 'en', 1234], ['1.234', 'en', null], ['1,234.56', 'en', 1234.56], ['12,50', 'en', 12.5],
    ['1 234,56', 'fr', 1234.56], ['1.234,56', 'es', 1234.56], ['0,123', undefined, null],
  ] as const)('«%s» in %s', (raw, lang, expected) => {
    expect(parseAmount(raw, lang)).toBe(expected)
  })
})

describe('Fase 2E: CSV dei movimenti in stile Revolut (sintetico)', () => {
  const csv = ['Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
    'CARD_PAYMENT,Current,2026-10-01 10:00:00,2026-10-02 09:00:00,QA Shop,-1234.50,1.00,EUR,COMPLETED,100.00',
    'CARD_PAYMENT,Current,2026-10-03 10:00:00,,QA Pending,-5.00,0.00,EUR,PENDING,95.00',
    'TOPUP,Current,2026-10-04 10:00:00,2026-10-04 10:00:00,QA Top-up,50.00,0.00,EUR,COMPLETED,145.00'].join('\n')
  it('usa la data di contabilizzazione, sottrae la commissione e spiega la riga in sospeso', () => {
    const res = readStatement(csv)
    expect(res.rows).toEqual([
      { date: '2026-10-02', description: 'QA Shop', amount: -1235.5, currency: 'EUR' },
      { date: '2026-10-04', description: 'QA Top-up', amount: 50, currency: 'EUR' }])
    expect(res.skipped).toEqual([{ line: 3, reason: 'pending' }])
  })
})
