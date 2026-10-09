// Stessi casi del test dell'Excel (budget-planner/test_calc.py): i numeri devono coincidere.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECURRING, SPLIT, addDays, computeMonth, computeYear, computeYears, defaultSettings, depositInterest, yearsRange,
  classify, emptyInvestments, monthOf, pacFutureValue, pacTracker, periodOf, portfolioSummary, rowIssues, undated, valueHolding, type Transaction,
} from './index'

const TODAY = '2026-10-09'
const s = defaultSettings({ firstMonth: { year: 2026, month: 1 }, recurring: DEFAULT_RECURRING })
s.fxRates.USD = 0.9

let n = 0
const tx = (date: string | null, description: string, category: string | null, amount: number | null,
            extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, description, category, amount, ...extra })

const all: Transaction[] = [
  tx('2026-01-01', 'Salary', 'salary', 1000),
  tx('2026-01-03', 'Bonus', 'extraIncome', 100, { paidFrom: 'qualityOfLife' }),
  tx('2026-01-05', 'Supermarket', 'groceries', 50, { paidFrom: 'qualityOfLife' }),
  tx('2026-01-08', 'Dinner', 'eatingOut', 30),
  tx('2026-01-09', 'ETF', 'investmentsSaving', 100),
  tx('2026-01-12', 'No category', null, 5),
  tx('2026-01-14', 'NYC dinner', 'eatingOut', 20, { currency: 'USD' }),
  // marzo: senza data, senza importo, doppione di un ricorrente (Gym, health, 29.90)
  tx(null, 'No date', 'other', 100),
  tx('2026-03-04', 'No amount', 'other', null),
  tx('2026-03-06', 'Gym again', 'health', 29.9),
  tx('2026-03-01', 'Salary', 'salary', 1000),
  // dicembre: i ricorrenti non sono ancora arrivati al loro giorno
  tx('2026-12-02', 'Supermarket', 'groceries', 40),
]

const jan = computeMonth({ year: 2026, month: 1 }, all, s, TODAY)
const bucket = (m: typeof jan, id: string) => m.buckets.find(b => b.bucket.id === id)!

describe('January (same numbers as the Excel test)', () => {
  it('summary', () => {
    expect(jan.income).toBeCloseTo(1100)
    expect(jan.spent).toBeCloseTo(145.88)          // 47.88 ricorrenti + 50 + 30 + 20 USD = 18
    expect(jan.saved).toBeCloseTo(100)
    expect(jan.leftOver).toBeCloseTo(854.12)
  })
  it('USD row converted', () => {
    expect(jan.transactions.find(t => t.description === 'NYC dinner')!.amountIn).toBeCloseTo(18)
  })
  it('buckets', () => {
    expect(bucket(jan, 'essentials').fromIncome).toBeCloseTo(550)
    expect(bucket(jan, 'essentials').spent).toBeCloseTo(47.88)
    expect(bucket(jan, 'essentials').remaining).toBeCloseTo(502.12)
    expect(bucket(jan, 'qualityOfLife').fromIncome).toBeCloseTo(300)
    expect(bucket(jan, 'qualityOfLife').spent).toBeCloseTo(98)
    expect(bucket(jan, 'safetyFund').remaining).toBeCloseTo(150)
    expect(bucket(jan, 'investments').remaining).toBeCloseTo(0)
  })
  it('checks', () => {
    expect(jan.checks.missingCategory).toBe(1)
    expect(jan.checks.missingFx).toBe(0)
    expect(jan.checks.missingDate + jan.checks.missingAmount).toBe(0)
  })
  it('recurring date (gym, day 1)', () => {
    expect(jan.transactions.find(t => t.description === 'Gym')!.date).toBe('2026-01-01')
  })
  it('spending by bucket', () => {
    const qol = jan.spendingByBucket.qualityOfLife
    expect(qol.map(t => t.description)).toEqual(['Supermarket', 'Dinner', 'NYC dinner'])
    expect(qol[2].amountIn).toBeCloseTo(18)
    expect(jan.spendingByBucket.investments[0].description).toBe('ETF')
    expect(Object.values(jan.spendingByBucket).flat().some(t => t.description === 'Bonus')).toBe(false)
  })
  it('income split by rule', () => {
    expect(jan.transactions.find(t => t.description === 'Salary')!.bucket).toBe(SPLIT)
  })
})

describe('carry over and later months', () => {
  it('February starts from January remaining', () => {
    const feb = computeMonth({ year: 2026, month: 2 }, all, s, TODAY)
    expect(bucket(feb, 'essentials').carriedOver).toBeCloseTo(502.12)
  })
  it('March checks', () => {
    const mar = computeMonth({ year: 2026, month: 3 }, all, s, TODAY)
    expect(mar.checks.missingAmount).toBe(1)
    expect(mar.checks.recurringDuplicate).toBe(1)
  })
  it('undated rows are kept apart and flagged', () => {
    const u = undated(all)
    expect(u.map(t => t.description)).toEqual(['No date'])
    expect(rowIssues({ ...u[0], type: 'expense', bucket: 'essentials', amountIn: 100 }, s)).toContain('missingDate')
  })
  it('December recurring are upcoming and not counted', () => {
    const dec = computeMonth({ year: 2026, month: 12 }, all, s, TODAY)
    expect(dec.transactions.filter(t => t.upcoming).length).toBe(3)
    expect(bucket(dec, 'essentials').spent).toBeCloseTo(40)
  })
})

describe('year overview', () => {
  const y = computeYear(2026, all, s, TODAY)
  it('savings rate = saved / income', () => {
    expect(y.rows[0].savingsRate).toBeCloseTo(100 / 1100)
  })
  it('total spent (Jan + Mar + Dec)', () => {
    expect(y.total.spent).toBeCloseTo(145.88 + (47.88 + 29.9) + 40)   // solo i mesi iniziati hanno i ricorrenti
  })
})

describe('periods', () => {
  it('month starting on day 27', () => {
    expect(periodOf({ year: 2026, month: 5 }, 27)).toEqual({ start: '2026-04-27', end: '2026-05-26' })
    expect(monthOf('2026-04-28', 27)).toEqual({ year: 2026, month: 5 })
    expect(monthOf('2026-04-26', 27)).toEqual({ year: 2026, month: 4 })
  })
})

describe('investments', () => {
  it('holding in your currency', () => {
    const h = valueHolding({ id: 'h1', name: 'World ETF', units: 10, avgPrice: 100, manualPrice: 110 }, s)
    expect(h.value).toBeCloseTo(1100); expect(h.gain).toBeCloseTo(100); expect(h.return).toBeCloseTo(0.1)
  })
  it('holding in USD is converted', () => {
    const h = valueHolding({ id: 'h2', name: 'US stock', currency: 'USD', units: 2, avgPrice: 100, manualPrice: 150 }, s)
    expect(h.invested).toBeCloseTo(180); expect(h.value).toBeCloseTo(270)
  })
  it('holding without rate is flagged', () => {
    expect(valueHolding({ id: 'h3', name: 'X', currency: 'JPY', units: 1, avgPrice: 1, manualPrice: 1 }, s).missingValue).toBe(true)
  })
  it('deposit interest, 1 year at 3%', () => {
    expect(depositInterest({ id: 'd1', name: 'D', amount: 1000, yearlyRate: 0.03, start: addDays(TODAY, -365) }, TODAY).interest)
      .toBeCloseTo(30)
  })
  it('PAC 120/month, 6%, 10 years', () => {
    expect(pacFutureValue(120, 0.06, 10)).toBeCloseTo(19665.52, 1)
  })
})

describe('years go on over time', () => {
  const s2 = defaultSettings({ firstMonth: { year: 2026, month: 11 } })
  const txs: Transaction[] = [
    tx('2026-11-01', 'Salary', 'salary', 1000),
    tx('2026-11-05', 'Food', 'groceries', 100),
    tx('2026-12-01', 'Salary', 'salary', 1000),
    tx('2027-01-01', 'Salary', 'salary', 1200),
    tx('2027-01-10', 'Trip', 'funShopping', 300),
    tx('2027-02-02', 'ETF', 'investmentsSaving', 100),
  ]
  const today = '2027-02-15'
  it('January 2027 starts from December 2026', () => {
    const y26 = computeYear(2026, txs, s2, today)
    const y27 = computeYear(2027, txs, s2, today)
    y26.buckets.forEach((b, i) => expect(y27.buckets[i].startOfYear).toBeCloseTo(b.endOfYear))
    expect(y26.buckets[0].endOfYear).toBeCloseTo(550 * 2 - 100)        // essenziali: 2 stipendi al 55% meno la spesa
  })
  it('year totals and categories', () => {
    const y27 = computeYear(2027, txs, s2, today)
    expect(y27.total.income).toBeCloseTo(1200)
    expect(y27.total.spent).toBeCloseTo(300)
    expect(y27.total.savingsRate).toBeCloseTo(100 / 1200)
    expect(y27.byCategory[0].category.id).toBe('funShopping')
  })
  it('lists every year from the first month to today', () => {
    const ys = computeYears(txs, s2, today)
    expect(ys.map(y => y.year)).toEqual([2026, 2027])
    expect(ys[1].endBalance).toBeCloseTo(2000 - 100 + 1200 - 300 - 100)   // il saldo complessivo continua
  })
  it('includes future years when there are future transactions', () => {
    expect(yearsRange([...txs, tx('2029-01-01', 'Plan', 'other', 1)], s2, today)).toEqual([2026, 2027, 2028, 2029])
  })
})

describe('currencies', () => {
  it('a transaction keeps the rate of the day it was logged', () => {
    const t1 = classify({ id: 'x', date: '2026-01-01', description: 'NY', category: 'eatingOut', amount: 100, currency: 'USD', fxRate: 0.8 }, s)
    expect(t1.amountIn).toBeCloseTo(80)                       // non il cambio attuale (0,9)
  })
  it('a manual rate wins over the automatic one', () => {
    const s3 = { ...s, fxManual: { USD: 0.95 } }
    expect(classify({ id: 'y', date: '2026-01-01', description: 'NY', category: 'eatingOut', amount: 100, currency: 'USD' }, s3).amountIn)
      .toBeCloseTo(95)
  })
})

describe('investments overview and PAC tracker (same numbers as the Excel test)', () => {
  it('overview with a USD stock and a deposit', () => {
    const inv = { ...emptyInvestments(),
      holdings: [{ id: 'a', name: 'World ETF', units: 10, avgPrice: 100, manualPrice: 110 },
                 { id: 'b', name: 'US stock', currency: 'USD', units: 2, avgPrice: 100, manualPrice: 150 }],
      deposits: [{ id: 'd', name: 'Deposit', amount: 1000, yearlyRate: 0.03, start: addDays(TODAY, -365) }] }
    const o = portfolioSummary(inv, s, TODAY)
    expect(o.invested).toBeCloseTo(2180)
    expect(o.value).toBeCloseTo(2400, 0)
  })
  it('tracker: January invested from the log, gain from the value you enter', () => {
    const y = computeYear(2026, all, s, TODAY)
    const rows = pacTracker(y.months, { monthly: 120, yearlyReturn: 0.06, years: 10 }, { '2026-01': 95 })
    expect(rows[0].invested).toBeCloseTo(100)
    expect(rows[0].gain).toBeCloseTo(-5)
  })
})
