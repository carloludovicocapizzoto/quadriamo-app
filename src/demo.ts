// Dati di esempio: due mesi realistici (il mese in corso e il precedente), con ricorrenti e una spesa "pagata da" un altro bucket.
import { DEFAULT_RECURRING, defaultSettings, makeDate, monthOf, parseDate, prevMonth, type Transaction } from './engine'
import type { AppData } from './store/state'

const VARIABLE = new Set(['groceries', 'eatingOut', 'transport', 'funShopping'])

export function demoAppData(today: string): AppData {
  const cur = monthOf(today, 1)
  const prev = prevMonth(cur)
  const settings = defaultSettings({ firstMonth: prev, recurring: [...DEFAULT_RECURRING,
    { name: 'Rent', amount: 450, category: 'fixedCosts', day: 1, active: true }] })
  settings.buckets.forEach((b, i) => { b.startingBalance = [0, 160, 40, 230][i] })

  const rows: [number, string, string, number, string?][] = [
    [1, 'Salary', 'salary', 1400],
    [2, 'ETF monthly plan', 'investmentsSaving', 120],
    [2, 'Safety fund transfer', 'safetyFundSaving', 200],
    [3, 'Supermarket', 'groceries', 52.35],
    [4, 'Aperitivo', 'eatingOut', 16.95],
    [6, 'Fuel', 'transport', 12.95],
    [9, 'Pizza with friends', 'eatingOut', 28.74],
    [10, 'Supermarket', 'groceries', 54.52],
    [13, 'Cinema', 'funShopping', 37.15],
    [14, 'Freelance project', 'extraIncome', 220, 'investments'],
    [16, 'Metro top-up', 'transport', 22.2],
    [20, 'Big grocery run', 'groceries', 66.97, 'qualityOfLife'],
    [24, 'Supermarket', 'groceries', 52.41],
  ]
  const todayDay = parseDate(today).day
  const txs: Transaction[] = []
  for (const ym of [prev, cur]) {
    rows.forEach(([day, description, category, amount, paidFrom], i) => {
      if (ym === cur && day > todayDay) return                      // niente movimenti nel futuro
      txs.push({ id: `demo-${ym.month}-${i}`, date: makeDate(ym.year, ym.month, day), description, category,
                 amount: ym === cur && VARIABLE.has(category) ? Math.round(amount * 0.93 * 100) / 100 : amount, paidFrom: paidFrom ?? null })
    })
  }
  return { version: 1, settings, transactions: txs, demo: true }
}
