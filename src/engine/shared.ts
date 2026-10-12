// Budget comune: quote di ogni spesa, saldo di ognuno e chi deve quanto a chi (con il minor numero di passaggi).
export type SplitMode = 'equal' | 'income' | 'custom' | 'payer'
export interface SMember { user_id: string; display_name: string; income: number | null; share: number | null }
export interface SExpense {
  id: string; paid_by: string; date: string; description: string; amount: number; category: string | null
  split: { mode: SplitMode; shares?: Record<string, number> } | null   // null = divisione del budget
}
export interface SSettlement { id?: string; from_user: string; to_user: string; amount: number; date?: string }
export interface Transfer { from: string; to: string; amount: number }

const round = (n: number) => Math.round(n * 100) / 100

/** Quota (da 0 a 1) di ogni persona per una spesa. Se mancano i dati per la regola scelta, si divide a metà. */
export function sharesFor(e: SExpense, members: SMember[], budgetMode: Exclude<SplitMode, 'payer'>): Record<string, number> {
  const ids = members.map(m => m.user_id)
  const equal = Object.fromEntries(ids.map(id => [id, 1 / ids.length]))
  const mode = e.split?.mode ?? budgetMode
  if (mode === 'payer') return Object.fromEntries(ids.map(id => [id, id === e.paid_by ? 1 : 0]))
  if (mode === 'income') {
    const tot = members.reduce((a, m) => a + (m.income ?? 0), 0)
    if (tot <= 0 || members.some(m => m.income == null)) return equal
    return Object.fromEntries(members.map(m => [m.user_id, (m.income ?? 0) / tot]))
  }
  if (mode === 'custom') {
    const raw = e.split?.shares ?? Object.fromEntries(members.map(m => [m.user_id, m.share ?? 0]))
    const tot = ids.reduce((a, id) => a + (raw[id] ?? 0), 0)
    if (tot <= 0) return equal
    return Object.fromEntries(ids.map(id => [id, (raw[id] ?? 0) / tot]))
  }
  return equal
}

/** Saldo di ognuno: positivo = deve ricevere, negativo = deve dare. */
export function balances(members: SMember[], expenses: SExpense[], settlements: SSettlement[],
                         budgetMode: Exclude<SplitMode, 'payer'>): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(members.map(m => [m.user_id, 0]))
  for (const e of expenses) {
    if (!(e.paid_by in bal)) continue                  // chi ha pagato non è più nel budget: la spesa resta, non pesa sui saldi
    bal[e.paid_by] += e.amount
    for (const [id, q] of Object.entries(sharesFor(e, members, budgetMode))) bal[id] -= e.amount * q
  }
  for (const s of settlements) {
    if (s.from_user in bal) bal[s.from_user] += s.amount
    if (s.to_user in bal) bal[s.to_user] -= s.amount
  }
  return Object.fromEntries(Object.entries(bal).map(([k, v]) => [k, round(v)]))
}

/** Chi deve quanto a chi, con il minor numero di passaggi (chi deve di più paga chi deve ricevere di più). */
export function transfers(bal: Record<string, number>): Transfer[] {
  const debt = Object.entries(bal).filter(([, v]) => v < -0.004).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v)
  const cred = Object.entries(bal).filter(([, v]) => v > 0.004).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v)
  const out: Transfer[] = []
  let i = 0, j = 0
  while (i < debt.length && j < cred.length) {
    const x = Math.min(debt[i].v, cred[j].v)
    if (x > 0.004) out.push({ from: debt[i].id, to: cred[j].id, amount: round(x) })
    debt[i].v -= x; cred[j].v -= x
    if (debt[i].v <= 0.004) i++
    if (cred[j].v <= 0.004) j++
  }
  return out
}
