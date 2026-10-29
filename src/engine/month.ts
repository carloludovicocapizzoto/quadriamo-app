// Calcolo di un mese: è la traduzione delle formule dei fogli mese dell'Excel di Quadriamo.
import { compareYm, monthOf, periodOf, prevMonth, ymKey } from './dates'
import { budgetEvents, occurrenceKey, occurrences } from './calendar'
import { minorDigits } from './bankNumbers'
import {
  CUSTOM, FIRST, SPLIT,
  type BucketRow, type Divided, type CheckKind, type ClassifiedTx, type MonthResult, type Settings,
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

const linkedCache = new WeakMap<Transaction[], Set<string>>()
/** Le volte delle spese fisse già pagate da un movimento collegato (transaction.occurrence): non generano il pagamento automatico. */
export function linkedOccurrences(all: Transaction[]): Set<string> {
  let hit = linkedCache.get(all)
  if (!hit) {
    hit = new Set(all.flatMap(t => t.occurrence ? [occurrenceKey(t.occurrence.eventId, t.occurrence.date)] : []))
    linkedCache.set(all, hit)
  }
  return hit
}

/**
 * I pagamenti del calendario nel mese (engine/calendar: affitto, bollette, rate…): compaiono quando il mese è iniziato
 * (c'è almeno un movimento con importo) e contano solo dal loro giorno; prima sono "upcoming", con l'importo previsto a parte.
 * Ogni volta conta una sola volta: se un movimento la paga (`linked`, transaction.occurrence) il pagamento automatico non c'è,
 * nemmeno prima della scadenza; resta il movimento, con il suo importo vero.
 */
export function recurringOf(ym: YearMonth, manual: Transaction[], s: Settings, today: string, linked: Set<string> = new Set()): ClassifiedTx[] {
  if (!manual.some(t => t.amount != null)) return []
  const { start, end } = periodOf(ym, s.monthStartDay)
  return budgetEvents(s).flatMap(e => occurrences(e, start, end).filter(date => !linked.has(occurrenceKey(e.id, date))).map(date => {
    const due = date <= today
    return {
      ...classify({ id: `ev-${e.id}-${date}`, date, description: e.title, category: e.category, amount: due ? e.amount : null }, s),
      recurring: true, upcoming: !due, planned: e.amount ?? 0, eventId: e.id, confirmed: e.done.includes(date),
    }
  })).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
}

/**
 * Divide `amount` secondo i pesi (quote della regola o «a modo mio») senza perdere né creare centesimi: si lavora in unità
 * minime della valuta (`digits`: EUR 2, JPY 0, KWD 3), ogni parte prende la sua quota troncata e le unità che avanzano vanno
 * alle parti con la frazione più grande; a parità vince la parte che viene prima (regola dei resti maggiori, come paydayPlan).
 * La somma delle parti è sempre l'importo arrotondato alla valuta: pesi che non fanno 100% (vecchi backup, dati non validi)
 * si leggono in proporzione; pesi tutti nulli, negativi o non numerici mandano tutto alla prima parte, mai soldi che spariscono.
 */
export function allocate(amount: number, weights: number[], digits = 2): number[] {
  const scale = 10 ** digits
  const sign = amount < 0 ? -1 : 1
  const units = Math.round(Math.abs(amount) * scale)
  const clean = weights.map(w => Number.isFinite(w) && w > 0 ? w : 0)
  const total = clean.reduce((a, w) => a + w, 0)
  const w = total > 0 ? clean.map(x => x / total) : clean.map((_, i) => i === 0 ? 1 : 0)
  const raw = w.map(x => units * x)
  const whole = raw.map(x => Math.floor(x + 1e-9))
  const order = raw.map((x, i) => ({ i, f: Math.round((x - whole[i]) * 1e6) })).sort((a, b) => b.f - a.f || a.i - b.i)
  let left = units - whole.reduce((a, x) => a + x, 0)
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) whole[order[k].i]++
  return whole.map(x => sign * x / scale)
}

/**
 * Le parti di questo mese dalla divisione cumulata: si divide il totale dal primo mese fino a qui e si toglie quello che era
 * già stato diviso fino al mese prima. Così l'arrotondamento non si accumula (con 10,25 € ogni mese una parte perdeva
 * mezzo centesimo al mese, 12 centesimi in due anni): ogni parte resta entro un'unità della sua quota esatta.
 */
const divideSince = (before: number, now: number, weights: number[], digits: number) => {
  const a = allocate(before + now, weights, digits), b = allocate(before, weights, digits)
  return a.map((x, i) => Math.round((x - b[i]) * 10 ** digits) / 10 ** digits)
}

/** Somma delle quote di un'entrata divisa a modo mio (1 = 100%), arrotondata per non sbagliare sui decimali. */
export const splitTotal = (split: Record<string, number> | null | undefined) =>
  Math.round(Object.values(split ?? {}).reduce((a, x) => a + x, 0) * 1000) / 1000
export const splitOk = (split: Record<string, number> | null | undefined) =>
  Object.values(split ?? {}).every(x => Number.isFinite(x) && x >= 0 && x <= 1) && splitTotal(split) === 1

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
  // un movimento collegato a una volta è quella volta, non un doppione
  if (t.category && t.amount != null && !t.occurrence &&
      budgetEvents(s).some(e => e.category === t.category && e.amount === t.amount)) out.push('recurringDuplicate')
  return out
}

const sum = (xs: ClassifiedTx[]) => xs.reduce((a, t) => a + (t.amountIn ?? 0), 0)

// I mesi già calcolati, per gli stessi dati: movimenti e impostazioni sono oggetti che non cambiano (ogni modifica ne crea
// di nuovi), quindi la stessa coppia dà sempre gli stessi mesi. Senza questa cache ogni schermata ricalcolava tutti i mesi
// dall'inizio (con 2 anni di movimenti, 0,3 s su un telefono medio a ogni ritorno alla Home).
const shared = new WeakMap<Transaction[], WeakMap<Settings, { today: string; months: Map<string, MonthResult> }>>()

/** La cache dei mesi per questi dati e per oggi: la usano tutti i calcoli, così un mese si calcola una volta sola. */
export function monthCache(all: Transaction[], s: Settings, today: string): Map<string, MonthResult> {
  let bySettings = shared.get(all)
  if (!bySettings) { bySettings = new WeakMap(); shared.set(all, bySettings) }
  let entry = bySettings.get(s)
  if (!entry || entry.today !== today) { entry = { today, months: new Map() }; bySettings.set(s, entry) }
  return entry.months
}

/**
 * Calcola un mese. `carriedOver` è il "remaining" del mese prima per bucket; se manca,
 * si calcola risalendo fino a `settings.firstMonth` (dove valgono i saldi iniziali).
 * I risultati sono condivisi (monthCache): non vanno modificati.
 */
export function computeMonth(
  ym: YearMonth, all: Transaction[], s: Settings, today: string,
  carriedOver?: Record<string, number>, cache: Map<string, MonthResult> = monthCache(all, s, today),
): MonthResult {
  const key = ymKey(ym)
  const normal = !carriedOver   // con un riporto passato a mano il risultato non va in cache
  const hit = cache.get(key)
  if (hit && normal) return hit

  const manual = transactionsOf(ym, all, s).map(t => classify(t, s))
  const txs = [...recurringOf(ym, manual, s, today, linkedOccurrences(all)), ...manual]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  // quanto era già stato diviso fino al mese prima (zero dal primo mese, o con un riporto passato a mano)
  let before: Divided = { ruled: 0, custom: {} }
  if (!carriedOver) {
    if (compareYm(ym, s.firstMonth) <= 0) {
      carriedOver = Object.fromEntries(s.buckets.map(b => [b.id, b.startingBalance]))
    } else {
      const prev = computeMonth(prevMonth(ym), all, s, today, undefined, cache)
      carriedOver = Object.fromEntries(prev.buckets.map(r => [r.bucket.id, r.remaining]))
      before = prev.divided ?? before
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

  // le quote al centesimo (all'unità minima della valuta): la somma delle parti è esattamente quella delle entrate divise
  const digits = minorDigits(s.currency)
  const shares = s.buckets.map(b => b.share)
  const ruled = divideSince(before.ruled, Math.max(0, base), shares, digits)
  // «a modo mio»: ogni combinazione di quote ha il suo totale cumulato
  const byWeights = new Map<string, { weights: number[]; amount: number }>()
  for (const t of custom) {
    const weights = s.buckets.map(b => t.split![b.id] ?? 0), key = weights.join(',')
    const g = byWeights.get(key) ?? { weights, amount: 0 }
    g.amount += t.amountIn ?? 0; byWeights.set(key, g)
  }
  const customParts = [...byWeights].map(([key, g]) => divideSince(before.custom[key] ?? 0, g.amount, g.weights, digits))
  const divided: Divided = { ruled: before.ruled + Math.max(0, base), custom: { ...before.custom } }
  for (const [key, g] of byWeights) divided.custom[key] = (divided.custom[key] ?? 0) + g.amount
  const buckets: BucketRow[] = s.buckets.map((b, i) => {
    const fromIncome = ruled[i] + (i === 0 ? Math.min(0, base) : 0) + sum(of('income').filter(t => t.bucket === b.id))
      + customParts.reduce((a, parts) => a + parts[i], 0)
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
    income, spent, saved, leftOver: income - spent - saved, paidFirst, divided,
    buckets, byCategory, checks, spendingByBucket,
  }
  if (normal) cache.set(key, result)
  return result
}

/** Movimenti senza data: non appartengono a nessun mese, l'app li mostra da completare. */
export const undated = (all: Transaction[]) => all.filter(t => !t.date)
