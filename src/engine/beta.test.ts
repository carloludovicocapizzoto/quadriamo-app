import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECURRING, computeMonth, defaultSettings, detectColumns, keywordFor, parseBankAmount, parseBankDate, paydayPlan,
  readStatement, safeToSpend, suggest, type Transaction,
} from './index'

const s = defaultSettings({ firstMonth: { year: 2026, month: 10 }, recurring: DEFAULT_RECURRING })

describe('keyword rules', () => {
  it('recognises shops and services', () => {
    expect(suggest('POS ESSELUNGA MILANO 1234', -52.3, s).category).toBe('groceries')
    expect(suggest('Netflix.com', -12.99, s).category).toBe('fixedCosts')
    expect(suggest('Bonifico Trade Republic Bank', -120, s).category).toBe('investmentsSaving')
    expect(suggest('STIPENDIO OTTOBRE ACME SRL', 1500, s).category).toBe('salary')
  })
  it('does not match inside other words', () => {
    expect(suggest('Benissimo shop', -10, s).category).toBe(null)       // "eni" dentro "benissimo"
  })
  it('an unknown income goes to extra income, an unknown expense waits for the user', () => {
    expect(suggest('Bonifico da Mario', 50, s).category).toBe('extraIncome')
    expect(suggest('Negozio sconosciuto', -20, s).category).toBe(null)
  })
  it('the longest keyword wins and user rules can choose the bucket', () => {
    const s2 = { ...s, rules: [...(s.rules ?? []), { id: 'u1', keyword: 'amazon prime', category: 'fixedCosts', paidFrom: 'qualityOfLife', enabled: true }] }
    expect(suggest('AMAZON PRIME*AB12', -4.99, s2)).toMatchObject({ category: 'fixedCosts', paidFrom: 'qualityOfLife' })
    expect(suggest('AMAZON MKTPLACE', -30, s2).category).toBe('funShopping')
  })
  it('proposes a keyword from a description', () => {
    expect(keywordFor('PAGAMENTO POS BAR CENTRALE 12/10')).toBe('bar centrale')
  })
})

describe('bank statement import', () => {
  it('reads a Revolut export (completed only, fee included)', () => {
    const csv = 'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n' +
      'CARD_PAYMENT,Current,2026-10-01 10:00:00,2026-10-02 09:00:00,Esselunga,-52.30,0.00,EUR,COMPLETED,100\n' +
      'CARD_PAYMENT,Current,2026-10-03 10:00:00,,Pending shop,-10.00,0.00,EUR,PENDING,90\n' +
      'TOPUP,Current,2026-10-04 10:00:00,2026-10-04 10:00:00,Top-up,200.00,1.00,EUR,COMPLETED,290\n'
    const { rows } = readStatement(csv)
    expect(rows).toEqual([
      { date: '2026-10-02', description: 'Esselunga', amount: -52.3, currency: 'EUR' },
      { date: '2026-10-04', description: 'Top-up', amount: 199, currency: 'EUR' },
    ])
  })
  it('reads an Italian bank export with ; and debit/credit columns', () => {
    const csv = 'Data contabile;Data valuta;Descrizione;Dare;Avere\n' +
      '05/10/2026;05/10/2026;PAGAMENTO POS CONAD;23,40;\n' +
      '27/10/2026;27/10/2026;STIPENDIO OTTOBRE;;1.500,00\n'
    expect(readStatement(csv).rows).toEqual([
      { date: '2026-10-05', description: 'PAGAMENTO POS CONAD', amount: -23.4, currency: null },
      { date: '2026-10-27', description: 'STIPENDIO OTTOBRE', amount: 1500, currency: null },
    ])
  })
  it('reads an N26 export', () => {
    const csv = '"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)"\n' +
      '"2026-10-07","2026-10-07","Spotify","","Presentment","Premium","Main","-10.99"\n'
    expect(readStatement(csv).rows[0]).toMatchObject({ date: '2026-10-07', amount: -10.99 })
    expect(readStatement(csv).rows[0].description).toContain('Spotify')
  })
  it('understands dates and amounts in many formats', () => {
    expect(parseBankDate('2026-10-02 09:00:00')).toBe('2026-10-02')
    expect(parseBankDate('3.4.2026')).toBe('2026-04-03')
    expect(parseBankAmount('-1.234,56 €')).toBe(-1234.56)
    expect(parseBankAmount('1,234.56')).toBe(1234.56)
    expect(parseBankAmount('(12.00)')).toBe(-12)
    expect(detectColumns(['foo', 'bar'])).toBe(null)
  })
})

describe('safe to spend and payday plan', () => {
  const txs: Transaction[] = [
    { id: 'a', date: '2026-10-01', description: 'Salary', category: 'salary', amount: 2000 },
    { id: 'b', date: '2026-10-05', description: 'Food', category: 'groceries', amount: 300 },
  ]
  const r = computeMonth({ year: 2026, month: 10 }, txs, s, '2026-10-10')
  it('per day, keeping aside the recurring payments still to come', () => {
    const ess = safeToSpend(r, s, '2026-10-10').find(x => x.bucketId === 'essentials')!
    // essenziali: 1100 dallo stipendio - 300 spesa - 10,99 telefono (già passato il 5) - 29,90 palestra (giorno 1)
    expect(ess.remaining).toBeCloseTo(1100 - 300 - 10.99 - 29.9)
    expect(ess.reserved).toBeCloseTo(6.99)                     // streaming il 18 non è ancora arrivato
    expect(ess.daysLeft).toBe(22)                              // dal 10 al 31 ottobre
    expect(ess.perDay).toBeCloseTo((1100 - 300 - 10.99 - 29.9 - 6.99) / 22)
  })
  it('only spending buckets, only in the current period', () => {
    expect(safeToSpend(r, s, '2026-10-10').map(x => x.bucketId)).toEqual(['essentials', 'qualityOfLife'])
    expect(safeToSpend(r, s, '2026-11-02')).toEqual([])
  })
  it('payday plan follows the rule', () => {
    expect(paydayPlan(r)).toEqual([
      { bucketId: 'essentials', amount: 1100 }, { bucketId: 'qualityOfLife', amount: 400 },
      { bucketId: 'safetyFund', amount: 300 }, { bucketId: 'investments', amount: 200 },
    ])
  })
})
