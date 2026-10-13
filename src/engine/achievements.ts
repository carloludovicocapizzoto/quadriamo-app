// Il numero del giorno e i traguardi: piccoli obiettivi che rendono l'abitudine visibile.
import { safeToSpend } from './spend'
import type { MonthResult, Settings } from './types'


/** Quanto si è speso oggi (spese variabili, non i ricorrenti) e quanto si poteva spendere stamattina. */
export function todayBudget(r: MonthResult, s: Settings, today: string) {
  const safe = safeToSpend(r, s, today)
  const ids = new Set(safe.map(x => x.bucketId))
  let spent = 0
  for (const t of r.transactions) {
    if (t.type === 'expense' && !t.upcoming && !t.recurring && t.date === today && t.amountIn != null && t.bucket && ids.has(t.bucket)) spent += t.amountIn
  }
  // il numero del mattino: quello di adesso più quanto speso oggi, diviso i giorni che restavano stamattina
  const allowance = safe.reduce((a, x) => a + Math.max(0, x.free + (spentOn(r, x.bucketId, today))) / x.daysLeft, 0)
  const left = safe.reduce((a, x) => a + x.perDay, 0)
  return { spent: round(spent), allowance: round(allowance), left: round(left), parts: safe }
}
const spentOn = (r: MonthResult, bucket: string, day: string) => r.transactions
  .filter(t => t.type === 'expense' && !t.upcoming && !t.recurring && t.date === day && t.bucket === bucket)
  .reduce((a, t) => a + (t.amountIn ?? 0), 0)
const round = (n: number) => Math.round(n * 100) / 100


export interface Badge { id: string; done: boolean; progress: number; goal: number }

/** Traguardi: si sbloccano usando l'app. `months` sono i mesi già chiusi (dal più vecchio). */
export function badges(input: { txCount: number; bestStreak: number; imported: boolean; goalsDone?: number; months: { income: number; leftOver: number; saved: number }[] }): Badge[] {
  const saved = input.months.reduce((a, m) => a + Math.max(0, m.saved), 0)
  const positive = input.months.filter(m => m.income > 0 && m.leftOver >= 0).length
  const b = (id: string, value: number, goal: number): Badge => ({ id, done: value >= goal, progress: Math.min(1, value / goal), goal })
  return [
    b('first', input.txCount, 1),
    b('streak3', input.bestStreak, 3),
    b('streak7', input.bestStreak, 7),
    b('streak30', input.bestStreak, 30),
    b('import', input.imported ? 1 : 0, 1),
    b('positive', positive, 1),
    b('positive3', positive, 3),
    b('saved1000', saved, 1000),
    b('goal', input.goalsDone ?? 0, 1),
  ]
}
