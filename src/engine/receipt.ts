// La ricevuta del mese: il riassunto di un mese in forma di scontrino. Totali (entrate, uscite, risparmio, investimenti,
// quanto resta), le categorie dalla più cara, il confronto col mese prima e qualche curiosità. Solo regole e dati
// del telefono (nessuna IA): ogni riga si può verificare nei movimenti.
import { computeMonth } from './month'
import { daysBetween, prevMonth } from './dates'
import type { Category, MonthResult, Settings, Transaction, YearMonth } from './types'

export interface ReceiptLine { category: Category; amount: number; count: number }
export type Curiosity =
  | { id: 'priciestDay'; date: string; amount: number }
  | { id: 'daysLogged'; days: number; of: number }
  | { id: 'savedShare'; pct: number }
  | { id: 'smallOnes'; count: number; amount: number }      // spese sotto i 10 € (caffè, snack…): quante e quanto in tutto
  | { id: 'biggest'; description: string; amount: number }

export interface Receipt {
  ym: YearMonth
  period: { start: string; end: string }
  closed: boolean                    // il mese è finito
  income: number; spent: number; saved: number; invested: number; leftOver: number
  lines: ReceiptLine[]               // categorie di spesa, dalla più cara
  top: ReceiptLine | null
  prev: { ym: YearMonth; spent: number; diff: number; pct: number | null } | null
  buckets: { id: string; spent: number; share: number }[]   // per il grafico: quanto ha speso ogni parte
  curiosities: Curiosity[]
  count: number                      // movimenti del mese
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function monthReceipt(ym: YearMonth, txs: Transaction[], s: Settings, today: string): Receipt {
  const cache = new Map<string, MonthResult>()
  const r = computeMonth(ym, txs, s, today, undefined, cache)
  const real = r.transactions.filter(t => !t.upcoming && t.date && t.amountIn != null)
  const exp = real.filter(t => t.type === 'expense')
  const byCat = new Map<string, ReceiptLine>()
  for (const t of exp) {
    const c = s.categories.find(c => c.id === t.category)
    if (!c) continue
    const l = byCat.get(c.id) ?? { category: c, amount: 0, count: 0 }
    l.amount = r2(l.amount + t.amountIn!); l.count++
    byCat.set(c.id, l)
  }
  const lines = [...byCat.values()].sort((a, b) => b.amount - a.amount)
  const invested = r2(real.filter(t => t.type === 'saving' && s.categories.find(c => c.id === t.category)?.defaultBucket === 'investments')
    .reduce((a, t) => a + t.amountIn!, 0))

  let prev: Receipt['prev'] = null
  const pym = prevMonth(ym)
  if (pym.year * 12 + pym.month >= s.firstMonth.year * 12 + s.firstMonth.month) {
    const p = computeMonth(pym, txs, s, today, undefined, cache)
    if (p.transactions.some(t => !t.upcoming)) {
      const diff = r2(r.spent - p.spent)
      prev = { ym: pym, spent: r2(p.spent), diff, pct: p.spent > 0 ? Math.round((diff / p.spent) * 100) : null }
    }
  }

  const spentByBucket = r.buckets.map(b => ({ id: b.bucket.id, spent: r2(b.spent) }))
  const maxB = Math.max(1, ...spentByBucket.map(b => b.spent))
  const buckets = spentByBucket.map(b => ({ ...b, share: b.spent / maxB }))

  const curiosities: Curiosity[] = []
  const perDay = new Map<string, number>()
  for (const t of exp) perDay.set(t.date!, (perDay.get(t.date!) ?? 0) + t.amountIn!)
  const priciest = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0]
  if (priciest) curiosities.push({ id: 'priciestDay', date: priciest[0], amount: r2(priciest[1]) })
  const closed = today > r.period.end
  const of = closed ? daysBetween(r.period.start, r.period.end) + 1 : Math.max(1, daysBetween(r.period.start, today) + 1)
  const logged = new Set(real.filter(t => !t.recurring).map(t => t.date)).size
  if (logged) curiosities.push({ id: 'daysLogged', days: logged, of })
  if (r.income > 0 && r.saved > 0) curiosities.push({ id: 'savedShare', pct: Math.round((r.saved / r.income) * 100) })
  const small = exp.filter(t => !t.recurring && t.amountIn! < 10)
  if (small.length >= 5) curiosities.push({ id: 'smallOnes', count: small.length, amount: r2(small.reduce((a, t) => a + t.amountIn!, 0)) })
  const biggest = exp.filter(t => !t.recurring).sort((a, b) => b.amountIn! - a.amountIn!)[0]
  if (biggest) curiosities.push({ id: 'biggest', description: biggest.description.trim().slice(0, 28), amount: r2(biggest.amountIn!) })

  return {
    ym, period: r.period, closed, income: r2(r.income), spent: r2(r.spent), saved: r2(r.saved), invested, leftOver: r2(r.leftOver),
    lines, top: lines[0] ?? null, prev, buckets, curiosities, count: real.length,
  }
}
