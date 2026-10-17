// Report: andamento degli ultimi mesi, categorie che crescono, previsione di fine mese.
// Tutto calcolato sul dispositivo a partire dai movimenti, come il resto dell'app.
import { daysBetween, prevMonth } from './dates'
import { computeMonth, monthCache } from './month'
import type { Category, MonthResult, Settings, Transaction, YearMonth } from './types'

export interface TrendPoint { ym: YearMonth; income: number; spent: number; saved: number; leftOver: number }

/** Gli ultimi `n` mesi fino a `ym` compreso (il più vecchio per primo); salta i mesi prima dell'inizio. */
export function monthlyTrend(ym: YearMonth, n: number, txs: Transaction[], s: Settings, today: string): TrendPoint[] {
  const out: TrendPoint[] = []
  const cache = monthCache(txs, s, today)
  let cur = ym
  for (let i = 0; i < n; i++) {
    if (cur.year * 12 + cur.month < s.firstMonth.year * 12 + s.firstMonth.month) break
    const r = computeMonth(cur, txs, s, today, undefined, cache)
    out.unshift({ ym: cur, income: r.income, spent: r.spent, saved: r.saved, leftOver: r.leftOver })
    cur = prevMonth(cur)
  }
  return out
}

export interface CategoryChange { category: Category; now: number; before: number; diff: number; pct: number | null }

/** Spese per categoria fino al giorno `cutoff` del periodo (0 = primo giorno); senza `cutoff`, tutto il mese. */
function byCategoryUpTo(r: MonthResult, cutoff: number | null, variableOnly = false): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of r.transactions) {
    if (t.type !== 'expense' || t.upcoming || !t.date || t.amountIn == null || !t.category) continue
    if (variableOnly && (t.recurring || t.planned)) continue
    if (cutoff != null && daysBetween(r.period.start, t.date) > cutoff) continue
    m.set(t.category, (m.get(t.category) ?? 0) + t.amountIn)
  }
  return m
}

/**
 * Categorie di spesa che crescono o calano: il mese `ym` confrontato con la media dei `back` mesi precedenti
 * (solo quelli con dati). Se il mese è in corso, il confronto è allo stesso punto del mese (es. primi 12 giorni),
 * così un mese a metà non sembra sempre "in calo". Ordinate per differenza in euro, le più grandi prima.
 * `variableOnly`: senza i pagamenti ricorrenti (per le anomalie: un abbonamento nuovo non è una spesa "fuori dal solito").
 */
export function categoryChanges(ym: YearMonth, txs: Transaction[], s: Settings, today: string, back = 3, variableOnly = false): CategoryChange[] {
  const cache = monthCache(txs, s, today)
  const now = computeMonth(ym, txs, s, today, undefined, cache)
  const cutoff = today >= now.period.start && today <= now.period.end ? daysBetween(now.period.start, today) : null
  const prev: MonthResult[] = []
  let cur = prevMonth(ym)
  for (let i = 0; i < back; i++) {
    if (cur.year * 12 + cur.month < s.firstMonth.year * 12 + s.firstMonth.month) break
    prev.push(computeMonth(cur, txs, s, today, undefined, cache)); cur = prevMonth(cur)
  }
  if (!prev.length) return []
  const nowBy = byCategoryUpTo(now, cutoff, variableOnly)
  const avg = new Map<string, number>()
  for (const r of prev) for (const [id, v] of byCategoryUpTo(r, cutoff, variableOnly)) avg.set(id, (avg.get(id) ?? 0) + v / prev.length)
  const out: CategoryChange[] = []
  for (const c of s.categories) {
    if (c.type !== 'expense') continue
    const n = Math.round((nowBy.get(c.id) ?? 0) * 100) / 100
    const b = Math.round((avg.get(c.id) ?? 0) * 100) / 100
    if (n === 0 && b === 0) continue
    const diff = Math.round((n - b) * 100) / 100
    out.push({ category: c, now: n, before: b, diff, pct: b > 0 ? Math.round((diff / b) * 100) : null })
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

export interface Forecast {
  spentSoFar: number      // uscite già fatte
  upcoming: number        // ricorrenti ancora da pagare questo mese
  variablePerDay: number  // media al giorno delle spese non ricorrenti finora
  projected: number       // spese previste a fine mese
  projectedLeftOver: number
  daysLeft: number
}

/** Previsione di fine mese: spese già fatte + ricorrenti in arrivo + ritmo attuale delle spese variabili per i giorni che restano. */
export function forecastMonth(r: MonthResult, today: string): Forecast | null {
  if (today < r.period.start || today > r.period.end) return null
  const elapsed = daysBetween(r.period.start, today) + 1
  const daysLeft = daysBetween(today, r.period.end)
  let spentSoFar = 0, upcoming = 0, variable = 0
  for (const t of r.transactions) {
    if (t.type !== 'expense' || t.amountIn == null) continue
    if (t.upcoming) { upcoming += t.amountIn; continue }
    if (!t.date || t.date > today) continue
    spentSoFar += t.amountIn
    if (!t.recurring) variable += t.amountIn
  }
  const variablePerDay = variable / elapsed
  const projected = Math.round((spentSoFar + upcoming + variablePerDay * daysLeft) * 100) / 100
  return {
    spentSoFar: Math.round(spentSoFar * 100) / 100, upcoming: Math.round(upcoming * 100) / 100,
    variablePerDay: Math.round(variablePerDay * 100) / 100, projected,
    projectedLeftOver: Math.round((r.income - r.saved - projected) * 100) / 100, daysLeft,
  }
}
