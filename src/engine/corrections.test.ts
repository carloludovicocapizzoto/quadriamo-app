import { describe, expect, it } from 'vitest'
import { computeMonth, defaultSettings, emptyInvestments, nth, occurrences, paydayPlan, portfolioSummary, safeToSpend, splitOk, type CalEvent, type Transaction } from '.'
import { validateSettings } from '../store/validate'

const ym = { year: 2026, month: 10 }
const settings = () => defaultSettings({ firstMonth: ym })
const salary: Transaction = { id: 'salary', date: '2026-10-01', description: 'Salary', category: 'salary', amount: 1000.05 }
const event = (x: Partial<CalEvent> = {}): CalEvent => ({ id: 'bill', kind: 'bill', title: 'Bill', amount: 100, category: 'fixedCosts', date: '2024-01-31', repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true, ...x })

describe('valutazione del portafoglio', () => {
  const holding = { id: 'h', name: 'ETF', units: 2, avgPrice: 50, manualPrice: null }
  it('un prezzo mancante non è un valore zero né una perdita', () => {
    expect(portfolioSummary({ ...emptyInvestments(), holdings: [holding] }, settings(), '2026-10-17'))
      .toMatchObject({ invested: 100, value: null, gain: null, return: null, missing: 1 })
  })
  it('un portafoglio misto resta incompleto, anche con depositi', () => {
    const inv = { ...emptyInvestments(), holdings: [holding, { ...holding, id: 'quoted', manualPrice: 60 }],
      deposits: [{ id: 'd', name: 'Deposit', amount: 200, yearlyRate: 0, start: '2026-10-01' }] }
    expect(portfolioSummary(inv, settings(), '2026-10-17')).toMatchObject({ invested: 400, value: null, gain: null, return: null })
  })
  it('zero è un prezzo valido; un cambio mancante è un dato incompleto', () => {
    expect(portfolioSummary({ ...emptyInvestments(), holdings: [{ ...holding, manualPrice: 0 }] }, settings(), '2026-10-17'))
      .toMatchObject({ value: 0, gain: -100, return: -1, missing: 0 })
    expect(portfolioSummary({ ...emptyInvestments(), holdings: [{ ...holding, currency: 'XYZ', manualPrice: 60 }] }, settings(), '2026-10-17'))
      .toMatchObject({ invested: null, value: null, gain: null, return: null })
  })
  it('quantità e costo mancanti non diventano rendimenti fittizi', () => {
    expect(portfolioSummary({ ...emptyInvestments(), holdings: [{ ...holding, units: null, manualPrice: 60 }] }, settings(), '2026-10-17').value).toBeNull()
    expect(portfolioSummary({ ...emptyInvestments(), holdings: [{ ...holding, avgPrice: null, manualPrice: 60 }] }, settings(), '2026-10-17'))
      .toMatchObject({ value: 120, invested: null, gain: null, return: null })
  })
})

describe('quote valide', () => {
  it.each([-0.1, 1.1, NaN, Infinity])('rifiuta una quota %s anche con totale apparentemente corretto', share => {
    const s = settings()
    s.buckets.forEach((b, i) => { b.share = i === 0 ? share : i === 1 ? 1 - share : 0 })
    expect(validateSettings(s)).toContain('sharesNot100')
    expect(splitOk({ a: share, b: 1 - share })).toBe(false)
  })
  it('accetta quote nulle e il 100%, mantenendo la tolleranza dei decimali', () => {
    expect(splitOk({ a: 0, b: 1 })).toBe(true)
    expect(splitOk({ a: 0.3333, b: 0.3333, c: 0.3334 })).toBe(true)
  })
  it.each(['2026-02-31', '2026-13-01'])('rifiuta una scadenza inesistente: %s', date => {
    expect(validateSettings({ ...settings(), events: [event({ date })] })).toContain('event')
  })
  it.each([0.5, Infinity, NaN])('rifiuta un intervallo di ricorrenza %s', every => {
    expect(validateSettings({ ...settings(), events: [event({ repeat: { every, unit: 'month' } })] })).toContain('event')
  })
})

describe('ricorrenze e previsione', () => {
  it('il salto iniziale coincide con la generazione dalla prima data, anche negli anni bisestili', () => {
    for (const unit of ['day', 'week', 'month', 'year'] as const) for (const every of [1, 2, 3, 7]) {
      const e = event({ date: '2000-02-29', repeat: { every, unit } })
      for (const [from, to] of [['2026-01-15', '2026-05-31'], ['2028-02-01', '2028-03-31']]) {
        const expected: string[] = []
        for (let n = 0, date = nth(e, 0); date <= to; date = nth(e, ++n)) if (date >= from) expected.push(date)
        expect(occurrences(e, from, to)).toEqual(expected)
      }
    }
  })
  it.each([0, 0.5, NaN, Infinity])('un intervallo non valido %s non genera occorrenze', every => {
    expect(occurrences(event({ repeat: { every, unit: 'month' } }), '2026-01-01', '2026-12-31')).toEqual([])
  })
  it.each(['2026-02-28', '2028-02-29', '2036-03-31'])('trova il giorno %s senza saltare ricorrenze vecchie', date => {
    expect(occurrences(event(), date, date)).toEqual([date])
  })
  it('rispetta intervalli, fine inclusiva e giorno originario dopo febbraio', () => {
    expect(occurrences(event({ repeat: { every: 2, unit: 'month' }, until: '2026-05-31' }), '2026-01-01', '2026-07-31'))
      .toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
    expect(occurrences(event(), '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-31'])
  })
  it('la spesa futura è messa da parte senza registrarla come già pagata', () => {
    const s = { ...settings(), events: [event({ date: '2026-09-25' })] }
    const rows = [salary, { id: 'food', date: '2026-10-05', description: 'Food', category: 'groceries', amount: 50 }]
    const r = computeMonth(ym, rows, s, '2026-10-17')
    expect(r.spent).toBe(50)
    expect(safeToSpend(r, s, '2026-10-17').reduce((a, x) => a + x.reserved, 0)).toBe(100)
    expect(safeToSpend(r, s, '2026-11-01')).toEqual([])
  })
  it('il giorno della scadenza conta una volta sola', () => {
    const s = { ...settings(), events: [event({ date: '2026-10-25' })] }
    for (const date of ['2026-10-24', '2026-10-25', '2026-10-26']) {
      const r = computeMonth(ym, [salary], s, date)
      expect(r.spent + safeToSpend(r, s, date).reduce((a, x) => a + x.reserved, 0)).toBe(100)
    }
  })
})

describe('piano di distribuzione in centesimi', () => {
  it('conserva il totale dopo affitto, entrate dirette e quote personalizzate', () => {
    const s = { ...settings(), events: [event({ kind: 'rent', category: 'rent', amount: 400, date: '2026-10-25' })] }
    const rows = [salary, { ...salary, id: 'direct', amount: 0.01, paidFrom: 'safetyFund' },
      { ...salary, id: 'custom', amount: 10.01, paidFrom: 'custom', split: { essentials: 0.5, investments: 0.5 } }]
    const r = computeMonth(ym, rows, s, '2026-10-17')
    expect(paydayPlan(r).reduce((sum, p) => sum + Math.round(p.amount * 100), 0)).toBe(61007)
  })
  it.each([1000.05, 0.01, 0.02, 0.03, 1.01])('non crea né perde centesimi da %s', amount => {
    const r = computeMonth(ym, [{ ...salary, amount }], settings(), '2026-10-17')
    const plan = paydayPlan(r)
    expect(plan.reduce((sum, p) => sum + Math.round(p.amount * 100), 0)).toBe(Math.round(amount * 100))
    expect(plan.every(p => p.amount > 0 && Math.abs(p.amount * 100 - Math.round(p.amount * 100)) < 1e-8)).toBe(true)
  })
  it('mantiene ordine stabile e non cambia i saldi mensili o negativi', () => {
    const r = computeMonth(ym, [salary], settings(), '2026-10-17')
    const before = structuredClone(r)
    expect(paydayPlan(r)).toEqual([
      { bucketId: 'essentials', amount: 550.03 }, { bucketId: 'qualityOfLife', amount: 200.01 },
      { bucketId: 'safetyFund', amount: 150.01 }, { bucketId: 'investments', amount: 100 },
    ])
    expect(r).toEqual(before)
    expect(paydayPlan({ ...r, buckets: r.buckets.map(b => ({ ...b, fromIncome: -1 })) })).toEqual([])
  })
})
