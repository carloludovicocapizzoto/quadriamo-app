// Calcolo di un mese: è la traduzione delle formule dei fogli mese dell'Excel di Quadriamo.
import { compareYm, monthOf, periodOf, prevMonth, ymKey } from './dates'
import { budgetEvents, occurrences } from './calendar'
import {
  CUSTOM, FIRST, SPLIT,
  type BucketRow, type CheckKind, type ClassifiedTx, type MonthResult, type Settings,
  type Transaction, type YearMonth,
} from './types'

/** Cambio attuale verso la tua valuta: quello scritto a mano se c'è, altrimenti quello automatico. */
export function fxRate(currency: string | null | undefined, s: Settings): number | null {
  if (!currency || currency === s.currency) return 1
  return s.fxManual?.[currency] ?? s.fxRates[currency] ?? null
}

/** Colonne calcolate di una riga: tipo, bucket, importo nella tua valuta. */
export function classify(tx: Transaction, s: Settings): ClassifiedTx {
  let type: ClassifiedTx['type'] = null
  let bucket: string | null = null
  if (tx.category) {
    const cat = s.categories.find(c => c.id === tx.category)
    type = cat ? cat.type : 'unknown'
    if (type === 'income') {
      // dove va un'entrata: la scelta del movimento, altrimenti quella della categoria, altrimenti la regola
      const choice = tx.paidFrom || cat?.defaultBucket || SPLIT
      if (choice === CUSTOM) {
        const split = tx.paidFrom === CUSTOM ? tx.split : cat?.split
        return withAmount({ ...tx, split: split ?? null }, s, type, SPLIT)
      }
      bucket = choice
      // quote rimaste da una scelta precedente non contano più
      if (tx.split) return withAmount({ ...tx, split: null }, s, type, bucket)
    }
    else if (tx.paidFrom && tx.paidFrom !== SPLIT) bucket = tx.paidFrom
    else bucket = cat?.defaultBucket ?? null
  }
  return withAmount(tx, s, type, bucket)
}

function withAmount(tx: Transaction, s: Settings, type: ClassifiedTx['type'], bucket: string | null): ClassifiedTx {
  let amountIn: number | null = null
  if (tx.amount != null) {
    if (!tx.currency || tx.currency === s.currency) amountIn = tx.amount
    else {
      const rate = tx.fxRate ?? fxRate(tx.currency, s)
      if (rate != null) amountIn = tx.amount * rate
    }
  }
  return { ...tx, type, bucket, amountIn }
}

/** Movimenti che appartengono al mese (per data). */
function transactionsOf(ym: YearMonth, all: Transaction[], s: Settings): Transaction[] {
  const key = ymKey(ym)
  return all.filter(t => t.date && ymKey(monthOf(t.date, s.monthStartDay)) === key)
}

/**
 * I pagamenti del calendario nel mese (engine/calendar: affitto, bollette, rate…): compaiono quando il mese è iniziato
 * (c'è almeno un movimento con importo) e contano solo dal loro giorno; prima sono "upcoming", con l'importo previsto a parte.
 */
export function recurringOf(ym: YearMonth, manual: Transaction[], s: Settings, today: string): ClassifiedTx[] {
  if (!manual.some(t => t.amount != null)) return []
  const { start, end } = periodOf(ym, s.monthStartDay)
  return budgetEvents(s).flatMap(e => occurrences(e, start, end).map(date => {
    const due = date <= today
    return {
      ...classify({ id: `ev-${e.id}-${date}`, date, description: e.title, category: e.category, amount: due ? e.amount : null }, s),
      recurring: true, upcoming: !due, planned: e.amount ?? 0, eventId: e.id,
    }
  })).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
}

/** Somma delle quote di un'entrata divisa a modo mio (1 = 100%), arrotondata per non sbagliare sui decimali. */
export const splitTotal = (split: Record<string, number> | null | undefined) =>
  Math.round(Object.values(split ?? {}).reduce((a, x) => a + x, 0) * 1000) / 1000
export const splitOk = (split: Record<string, number> | null | undefined) => splitTotal(split) === 1

/** Problemi di una singola riga (le righe rosse dell'Excel). */
export function rowIssues(t: ClassifiedTx, s: Settings): CheckKind[] {
  if (t.recurring) return []
  const out: CheckKind[] = []
  const filled = !!(t.date || t.description || t.category)
  if (t.amount != null && !t.date) out.push('missingDate')
  if (t.amount == null && filled) out.push('missingAmount')
  if (t.amount != null && !t.category) out.push('missingCategory')
  if (t.type === 'unknown') out.push('unknownCategory')
  if (t.amount != null && t.amountIn == null) out.push('missingFx')
  if (t.category && t.amount != null &&
      budgetEvents(s).some(e => e.category === t.category && e.amount === t.amount)) out.push('recurringDuplicate')
  return out
}

const sum = (xs: ClassifiedTx[]) => xs.reduce((a, t) => a + (t.amountIn ?? 0), 0)

/**
 * Calcola un mese. `carriedOver` è il "remaining" del mese prima per bucket; se manca,
 * si calcola risalendo fino a `settings.firstMonth` (dove valgono i saldi iniziali).
 */
export function computeMonth(
  ym: YearMonth, all: Transaction[], s: Settings, today: string,
  carriedOver?: Record<string, number>, cache: Map<string, MonthResult> = new Map(),
): MonthResult {
  const key = ymKey(ym)
  const hit = cache.get(key)
  if (hit && !carriedOver) return hit

  const manual = transactionsOf(ym, all, s).map(t => classify(t, s))
  const txs = [...recurringOf(ym, manual, s, today), ...manual]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  if (!carriedOver) {
    if (compareYm(ym, s.firstMonth) <= 0) {
      carriedOver = Object.fromEntries(s.buckets.map(b => [b.id, b.startingBalance]))
    } else {
      const prev = computeMonth(prevMonth(ym), all, s, today, undefined, cache)
      carriedOver = Object.fromEntries(prev.buckets.map(r => [r.bucket.id, r.remaining]))
    }
  }

  const of = (type: string) => txs.filter(t => t.type === type)
  const income = sum(of('income')), spent = sum(of('expense')), saved = sum(of('saving'))
  // entrate divise con la regola; quelle divise "a modo mio" vanno a ogni parte con le loro quote
  const split = sum(of('income').filter(t => t.bucket === SPLIT && !t.split))
  const custom = of('income').filter(t => t.bucket === SPLIT && t.split)
  // spese "prima delle parti" (es. l'affitto): escono dalle entrate prima della divisione. Quelle ancora in arrivo
  // contano con l'importo previsto, così le parti non sembrano più ricche all'inizio del mese
  const paidFirst = txs.filter(t => t.bucket === FIRST && t.type === 'expense')
    .reduce((a, t) => a + (t.amountIn ?? (t.upcoming ? t.planned ?? 0 : 0)), 0)
  const base = split - paidFirst   // se l'affitto supera le entrate, la differenza pesa sulla prima parte (non sparisce)

  const buckets: BucketRow[] = s.buckets.map((b, i) => {
    const fromIncome = Math.max(0, base) * b.share + (i === 0 ? Math.min(0, base) : 0) + sum(of('income').filter(t => t.bucket === b.id))
      + custom.reduce((a, t) => a + (t.amountIn ?? 0) * (t.split![b.id] ?? 0), 0)
    const out = sum(txs.filter(t => t.bucket === b.id && (t.type === 'expense' || t.type === 'saving')))
    const carried = carriedOver![b.id] ?? 0
    return { bucket: b, carriedOver: carried, fromIncome, spent: out,
             remaining: carried + fromIncome - out, available: carried + fromIncome }
  })

  const nonIncome = s.categories.filter(c => c.type !== 'income')
  const catTotal = nonIncome.reduce((a, c) => a + sum(txs.filter(t => t.category === c.id)), 0)
  const byCategory = nonIncome.map(c => {
    const amount = sum(txs.filter(t => t.category === c.id))
    return { category: c, amount, share: catTotal ? amount / catTotal : 0 }
  })

  const checks = Object.fromEntries(
    (['missingDate', 'missingAmount', 'missingCategory', 'unknownCategory', 'missingFx', 'recurringDuplicate'] as CheckKind[])
      .map(k => [k, 0])) as Record<CheckKind, number>
  for (const t of txs) for (const k of rowIssues(t, s)) checks[k]++

  const spendingByBucket = Object.fromEntries(s.buckets.map(b => [b.id,
    txs.filter(t => t.bucket === b.id && t.amount != null && (t.type === 'expense' || t.type === 'saving'))]))

  const result: MonthResult = {
    ym, period: periodOf(ym, s.monthStartDay), transactions: txs,
    income, spent, saved, leftOver: income - spent - saved, paidFirst,
    buckets, byCategory, checks, spendingByBucket,
  }
  cache.set(key, result)
  return result
}

/** Movimenti senza data: non appartengono a nessun mese, l'app li mostra da completare. */
export const undated = (all: Transaction[]) => all.filter(t => !t.date)
