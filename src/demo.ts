// Dati di esempio per l'anteprima della fase 0 (lo stesso maggio della demo dell'Excel, in breve).
import { DEFAULT_RECURRING, defaultSettings, type Settings, type Transaction } from './engine'

export function demoData(names: Record<string, string>, year: number, month: number): { settings: Settings; txs: Transaction[] } {
  const settings = defaultSettings({ firstMonth: { year, month }, names, recurring: DEFAULT_RECURRING })
  settings.buckets.forEach((b, i) => { b.startingBalance = [0, 160, 40, 230][i] })
  const d = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const rows: [number, string, string, number, string?][] = [
    [1, 'Salary', 'salary', 1400],
    [2, 'ETF monthly plan', 'investmentsSaving', 120],
    [2, 'Safety fund transfer', 'safetyFundSaving', 200],
    [1, 'Rent', 'fixedCosts', 450],
    [3, 'Supermarket', 'groceries', 52.35],
    [4, 'Aperitivo', 'eatingOut', 37.83],
    [5, 'Fuel', 'transport', 12.95],
    [5, 'Pizza with friends', 'eatingOut', 28.74],
    [6, 'Cinema', 'funShopping', 37.15],
    [7, 'Big grocery run', 'groceries', 66.97, 'qualityOfLife'],
  ]
  const txs = rows.map(([day, description, category, amount, paidFrom], i) =>
    ({ id: `demo-${i}`, date: d(day), description, category, amount, paidFrom: paidFrom ?? null }))
  return { settings, txs }
}
