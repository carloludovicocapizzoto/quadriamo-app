// Ricerca e filtri dei movimenti, su uno o più mesi (ricorrenti compresi, quelli "in arrivo" esclusi).
import { compareYm, prevMonth } from './dates'
import { computeMonth } from './month'
import type { ClassifiedTx, MonthResult, Settings, Transaction, TxType, YearMonth } from './types'

export type Period = 'month' | '3m' | 'year' | 'all'
export interface TxFilter {
  q: string
  types: TxType[]           // vuoto = tutti
  buckets: string[]         // vuoto = tutte le parti
  categories: string[]      // vuoto = tutte
  min: number | null
  max: number | null
}
export const EMPTY_FILTER: TxFilter = { q: '', types: [], buckets: [], categories: [], min: null, max: null }
export const activeFilters = (f: TxFilter) =>
  f.types.length + f.buckets.length + f.categories.length + (f.min != null ? 1 : 0) + (f.max != null ? 1 : 0)

/** I mesi da `from` a `to` compresi (il più recente per primo), senza andare prima del primo mese. */
export function monthsBetween(from: YearMonth, to: YearMonth, s: Settings): YearMonth[] {
  const out: YearMonth[] = []
  for (let cur = to; compareYm(cur, from) >= 0 && compareYm(cur, s.firstMonth) >= 0 && out.length < 600; cur = prevMonth(cur)) out.push(cur)
  return out
}

/** Primo mese del periodo scelto, contando dal mese `ym` (quello che si sta guardando). */
export function periodStart(p: Period, ym: YearMonth, s: Settings): YearMonth {
  if (p === 'month') return ym
  if (p === '3m') return prevMonth(prevMonth(ym))
  if (p === 'year') return { year: ym.year, month: 1 }
  return s.firstMonth
}

/** Movimenti già avvenuti dei mesi indicati, dal più recente. */
export function transactionsInMonths(months: YearMonth[], txs: Transaction[], s: Settings, today: string): ClassifiedTx[] {
  const cache = new Map<string, MonthResult>()
  const out: ClassifiedTx[] = []
  for (const ym of [...months].reverse()) out.push(...computeMonth(ym, txs, s, today, undefined, cache).transactions.filter(t => !t.upcoming))
  return out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Filtra i movimenti. `names` dà i nomi (tradotti) di categoria e parte, per cercarli nel testo. */
export function filterTransactions(list: ClassifiedTx[], f: TxFilter, names: { category: (id: string | null) => string; bucket: (id: string | null) => string }): ClassifiedTx[] {
  const words = norm(f.q).split(/\s+/).filter(Boolean)
  const num = Number(f.q.replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  const isNum = f.q.trim() !== '' && Number.isFinite(num)
  return list.filter(t => {
    const amount = Math.abs(t.amountIn ?? t.amount ?? 0)
    if (f.types.length && (!t.type || !f.types.includes(t.type))) return false
    if (f.buckets.length && (!t.bucket || !f.buckets.includes(t.bucket))) return false
    if (f.categories.length && (!t.category || !f.categories.includes(t.category))) return false
    if (f.min != null && amount < f.min - 0.005) return false
    if (f.max != null && amount > f.max + 0.005) return false
    if (!words.length) return true
    if (isNum && Math.abs(amount - num) < 0.005) return true
    const hay = norm(`${t.description} ${names.category(t.category)} ${names.bucket(t.bucket)} ${amount.toFixed(2).replace('.', ',')}`)
    return words.every(w => hay.includes(w))
  })
}

/** Totale con segno: entrate in più, spese e risparmi in meno. */
export function signedTotal(list: ClassifiedTx[]): number {
  return Math.round(list.reduce((a, t) => a + (t.type === 'income' ? 1 : -1) * Math.abs(t.amountIn ?? 0), 0) * 100) / 100
}
