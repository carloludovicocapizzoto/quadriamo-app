// Il piano del mese (docs/PIANO-DEL-MESE.md): numero del giorno sul reddito previsto, extra fuori dal numero,
// spese fisse contate una volta sola, «Conta nel mese», saldo di partenza. Solo dati sintetici.
import { describe, expect, it } from 'vitest'
import { computeMonth, defaultSettings, monthBudget, overspent, rowIssues, safeToSpend, splitBalance, type CalEvent, type Settings, type Transaction } from '.'
import en from '../i18n/en'
import it_ from '../i18n/it'
import fr from '../i18n/fr'
import es from '../i18n/es'

const oct = { year: 2026, month: 10 }
const base = (x: Partial<Settings> = {}): Settings => ({ ...defaultSettings({ firstMonth: { year: 2026, month: 9 } }), ...x })
const tx = (id: string, date: string, category: string, amount: number, x: Partial<Transaction> = {}): Transaction =>
  ({ id, date, description: id, category, amount, ...x })
const ev = (x: Partial<CalEvent>): CalEvent => ({ id: 'rent', kind: 'rent', title: 'Affitto', amount: 400, category: 'rent', date: '2026-01-01',
  repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true, ...x })
const perDay = (txs: Transaction[], s: Settings, today: string, ym = oct) => {
  const r = computeMonth(ym, txs, s, today)
  return Math.round(safeToSpend(r, s, today).reduce((a, x) => a + x.perDay, 0) * 100) / 100
}
const food = tx('food', '2026-10-02', 'groceries', 30)

describe('numero del giorno sul reddito previsto', () => {
  const s = base({ expectedIncome: 1200 })
  it('si calcola su quello che si prende di norma, anche prima che arrivi', () => {
    // parti di spesa 55% + 20% di 1.200 = 900, meno 30 di spesa, per 30 giorni (2–31 ottobre)
    expect(perDay([food], s, '2026-10-02')).toBe(29)
    expect(monthBudget(computeMonth(oct, [food], s, '2026-10-02'), s, '2026-10-02')).toMatchObject({ expected: 1200, received: 0, missing: 1200, extra: 0 })
  })
  it('più entrate: «mancano» scende fino a zero, l\'extra resta nelle parti ma non alza il numero', () => {
    const salary = tx('salary', '2026-10-01', 'salary', 1000), bonus = tx('bonus', '2026-10-01', 'extraIncome', 200), more = tx('more', '2026-10-02', 'extraIncome', 500)
    const today = '2026-10-02'
    expect(monthBudget(computeMonth(oct, [food, salary], s, today), s, today)).toMatchObject({ received: 1000, missing: 200, extra: 0 })
    expect(perDay([food, salary, bonus], s, today)).toBe(29)
    const r = computeMonth(oct, [food, salary, bonus, more], s, today)
    expect(monthBudget(r, s, today)).toMatchObject({ received: 1700, missing: 0, extra: 500, perDay: 29 })
    // l'extra è soldi veri: la parte Essenziali ha 1.700 × 55% − 30
    expect(r.buckets.find(b => b.bucket.id === 'essentials')!.remaining).toBeCloseTo(905)
  })
  it('l\'extra messo tutto negli investimenti non tocca le parti di spesa', () => {
    const r = computeMonth(oct, [food, tx('salary', '2026-10-01', 'salary', 1200), tx('x', '2026-10-02', 'extraIncome', 300, { paidFrom: 'investments' })], s, '2026-10-02')
    expect(r.buckets.find(b => b.bucket.id === 'investments')!.remaining).toBeCloseTo(420)
    expect(monthBudget(r, s, '2026-10-02')).toMatchObject({ extra: 300, perDay: 29 })
  })
  it('l\'affitto «prima delle parti» si toglie dal previsto prima di dividerlo', () => {
    const r = { ...s, events: [ev({})] }
    // (1.200 − 400) × 75% − 30 = 570, per 30 giorni
    expect(perDay([food], r, '2026-10-02')).toBe(19)
  })
  it('reddito previsto cambiato: il numero si ricalcola, i mesi passati restano uguali', () => {
    const sep = tx('sep', '2026-09-03', 'groceries', 50), today = '2026-10-02'
    const higher = { ...s, expectedIncome: 1500 }
    expect(perDay([sep, food], higher, today)).toBeGreaterThan(perDay([sep, food], s, today))
    expect(computeMonth({ year: 2026, month: 9 }, [sep, food], higher, today).buckets.map(b => b.remaining))
      .toEqual(computeMonth({ year: 2026, month: 9 }, [sep, food], s, today).buckets.map(b => b.remaining))
  })
  it('senza reddito previsto: niente budget, il numero resta sui soldi che ci sono', () => {
    const plain = base(), r = computeMonth(oct, [food, tx('salary', '2026-10-01', 'salary', 1000)], plain, '2026-10-02')
    expect(monthBudget(r, plain, '2026-10-02')).toBeNull()
    expect(safeToSpend(r, plain, '2026-10-02').map(x => x.remaining)).toEqual(r.buckets.filter(b => ['essentials', 'qualityOfLife'].includes(b.bucket.id)).map(b => b.remaining))
  })
  it('stipendio il 27 in ritardo: il numero non cambia quando arriva', () => {
    const s27 = base({ expectedIncome: 1200, monthStartDay: 27 }), nov = { year: 2026, month: 11 }
    const coffee = tx('coffee', '2026-10-28', 'eatingOut', 3)
    const before = computeMonth(nov, [coffee], s27, '2026-10-29')
    const after = computeMonth(nov, [coffee, tx('salary', '2026-10-30', 'salary', 1200)], s27, '2026-10-29')
    expect(before.period).toEqual({ start: '2026-10-27', end: '2026-11-26' })
    expect(monthBudget(before, s27, '2026-10-29')).toMatchObject({ missing: 1200, daysLeft: 29 })
    expect(monthBudget(after, s27, '2026-10-29')).toMatchObject({ missing: 0 })
    expect(monthBudget(after, s27, '2026-10-29')!.perDay).toBe(monthBudget(before, s27, '2026-10-29')!.perDay)
  })
})

describe('importi negativi e sforamenti', () => {
  const s = base({ expectedIncome: 1200 })
  it('un rimborso registrato come spesa negativa riduce la spesa', () => {
    const r = computeMonth(oct, [food, tx('refund', '2026-10-02', 'groceries', -20)], s, '2026-10-02')
    expect(r.spent).toBe(10)
  })
  it('il numero non va mai sotto zero; lo sforamento è un fatto', () => {
    const big = tx('tv', '2026-10-02', 'tech', 2000), today = '2026-10-02'
    const r = computeMonth(oct, [food, big], s, today)
    expect(monthBudget(r, s, today)).toMatchObject({ perDay: 21 })   // Essenziali 630 ancora positivi, per 30 giorni; Qualità della vita sotto zero non conta
    const huge = computeMonth(oct, [food, tx('car', '2026-10-02', 'groceries', 2000), big], s, today)
    expect(monthBudget(huge, s, today)).toMatchObject({ perDay: 0 })
    expect(overspent(huge, s, today)).toEqual({ amount: 3130, planned: true })
  })
})

describe('spese fisse: mai contate due volte', () => {
  const s = base({ events: [ev({})] }), today = '2026-10-02'
  it('pagata da sola alla scadenza: conta una volta', () => {
    expect(computeMonth(oct, [food], s, today).spent).toBe(430)
  })
  it('collegata a mano: conta una volta, con l\'importo vero', () => {
    const paid = tx('paid', '2026-10-01', 'rent', 410, { occurrence: { eventId: 'rent', date: '2026-10-01' } })
    const r = computeMonth(oct, [food, paid], s, today)
    expect(r.spent).toBe(440)
    expect(r.transactions.filter(t => t.category === 'rent')).toHaveLength(1)
    expect(rowIssues(r.transactions.find(t => t.id === 'paid')!, s)).toEqual([])
  })
  it('collegata prima della scadenza: non resta messa da parte', () => {
    const early = tx('early', '2026-09-30', 'rent', 400, { occurrence: { eventId: 'rent', date: '2026-11-01' } })
    const nov = computeMonth({ year: 2026, month: 11 }, [tx('n', '2026-11-01', 'groceries', 5), early], s, '2026-10-30')
    expect(nov.transactions.some(t => t.recurring)).toBe(false)
  })
  it('identica ma non collegata: conta due volte e la riga lo segnala, come prima', () => {
    const dup = tx('dup', '2026-10-01', 'rent', 400)
    const r = computeMonth(oct, [food, dup], s, today)
    expect(r.spent).toBe(830)
    expect(r.checks.recurringDuplicate).toBe(1)
  })
  it('abbonamento annuale: solo nel periodo in cui cade, messo da parte prima', () => {
    const yearly = base({ events: [ev({ id: 'y', kind: 'subscription', title: 'Annuale', amount: 120, category: 'funShopping', date: '2025-10-20', repeat: { every: 1, unit: 'year' } })] })
    const r = computeMonth(oct, [food], yearly, today)
    expect(safeToSpend(r, yearly, today).find(x => x.bucketId === 'qualityOfLife')!.reserved).toBe(120)
    expect(computeMonth({ year: 2026, month: 11 }, [tx('n', '2026-11-02', 'groceries', 5)], yearly, '2026-11-02').transactions.some(t => t.recurring)).toBe(false)
  })
})

describe('«Conta nel mese»', () => {
  const bill = ev({ id: 'bill', kind: 'bill', title: 'Luce', amount: 100, category: 'fixedCosts', date: '2026-09-05', planOffFrom: '2026-10-10' })
  const s = base({ events: [bill] })
  it('le volte prima dello spegnimento restano, quelle dopo escono dal piano', () => {
    expect(computeMonth({ year: 2026, month: 9 }, [tx('s', '2026-09-03', 'groceries', 1)], s, '2026-11-20').spent).toBe(101)
    expect(computeMonth(oct, [food], s, '2026-11-20').spent).toBe(130)
    expect(computeMonth({ year: 2026, month: 11 }, [tx('n', '2026-11-02', 'groceries', 1)], s, '2026-11-20').spent).toBe(1)
  })
  it('un pagamento vero di una spesa esclusa conta sempre, senza avviso di doppione', () => {
    const real = tx('real', '2026-11-05', 'fixedCosts', 100)
    const r = computeMonth({ year: 2026, month: 11 }, [real], s, '2026-11-20')
    expect(r.spent).toBe(100)
    expect(r.checks.recurringDuplicate).toBe(0)
  })
})

describe('saldo di partenza e inizio a metà mese', () => {
  it('diviso con la regola al centesimo', () => {
    const b = splitBalance(base().buckets, 1000.01)
    expect(b.map(x => x.startingBalance)).toEqual([550.01, 200, 150, 100])
  })
  it('stipendio già arrivato: il saldo di oggi conta, il previsto vale dal prossimo periodo; l\'affitto già pagato non si conta di nuovo', () => {
    const s = base({ firstMonth: oct, buckets: splitBalance(base().buckets, 1000), balanceDate: '2026-10-15',
      expectedIncome: 1200, expectedFrom: '2026-11', events: [ev({})] })
    const r = computeMonth(oct, [], s, '2026-10-15')
    expect(r.spent).toBe(0)
    expect(monthBudget(r, s, '2026-10-15')).toBeNull()
    // 550 + 200 nelle parti di spesa, per 17 giorni (15–31 ottobre)
    expect(Math.round(safeToSpend(r, s, '2026-10-15').reduce((a, x) => a + x.perDay, 0) * 100) / 100).toBe(44.12)
    // novembre: affitto e reddito previsto tornano nel piano
    const nov = computeMonth({ year: 2026, month: 11 }, [tx('n', '2026-11-02', 'groceries', 10)], s, '2026-11-02')
    expect(nov.spent).toBe(410)
    expect(monthBudget(nov, s, '2026-11-02')).toMatchObject({ expected: 1200, missing: 1200 })
  })
  it('stipendio non ancora arrivato: il previsto vale già da questo periodo', () => {
    const s = base({ firstMonth: oct, buckets: splitBalance(base().buckets, 100), balanceDate: '2026-10-15', expectedIncome: 1200 })
    expect(monthBudget(computeMonth(oct, [], s, '2026-10-15'), s, '2026-10-15')).toMatchObject({ expected: 1200, missing: 1200 })
  })
})

describe('niente più proiezioni «a questo ritmo»', () => {
  it.each([['it', it_, /a questo ritmo/i], ['en', en, /at this pace/i], ['fr', fr, /à ce rythme/i], ['es', es, /a este ritmo/i]] as const)('%s', (_, dict, re) => {
    expect(Object.values(dict).filter(v => re.test(v))).toEqual([])
  })
})
