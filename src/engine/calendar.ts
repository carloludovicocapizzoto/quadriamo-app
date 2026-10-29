// Il calendario finanziario: tutto ciò che succederà, in un solo concetto, l'evento. Affitto, bollette, rate, mutuo,
// abbonamenti, stipendio, dividendi, cedole, scadenze fiscali, promemoria liberi. Un evento può ripetersi (ogni N giorni,
// settimane, mesi o anni) e può avere una fine. Gli eventi di spesa con importo e categoria entrano nel budget del mese
// come facevano i "pagamenti ricorrenti" (month.ts, recurringOf): stessi conti, una fonte sola.
import { addDays, daysBetween, makeDate, parseDate, periodOf } from './dates'
import { goalStatus, type Goal } from './goals'
import type { Reminder } from './reminders'
import type { Recurring, Settings, YearMonth } from './types'

export type EventKind = 'rent' | 'bill' | 'loan' | 'mortgage' | 'subscription' | 'payment' | 'saving' | 'pac'
  | 'salary' | 'income' | 'dividend' | 'coupon' | 'tax' | 'reminder' | 'document'

/** In uscita (pagamenti) o in entrata: decide colore, segno e se può entrare nel budget come spesa. */
export const KIND_SIDE: Record<EventKind, 'out' | 'in' | 'none'> = {
  rent: 'out', bill: 'out', loan: 'out', mortgage: 'out', subscription: 'out', payment: 'out', saving: 'out', pac: 'out', tax: 'out',
  salary: 'in', income: 'in', dividend: 'in', coupon: 'in', reminder: 'none', document: 'none',
}
/** I tipi che si scelgono nel modulo dell'evento (i documenti hanno la loro pagina e il loro modulo). */
export const EVENT_KINDS = (Object.keys(KIND_SIDE) as EventKind[]).filter(k => k !== 'document')

export interface Repeat { every: number; unit: 'day' | 'week' | 'month' | 'year' }
/** Le ripetizioni più comuni, con un nome; le altre sono "personalizzate". */
export const REPEAT_PRESETS = {
  monthly: { every: 1, unit: 'month' }, bimonthly: { every: 2, unit: 'month' }, quarterly: { every: 3, unit: 'month' },
  semiannual: { every: 6, unit: 'month' }, yearly: { every: 1, unit: 'year' },
} as const satisfies Record<string, Repeat>
export type RepeatPreset = keyof typeof REPEAT_PRESETS

export interface CalEvent {
  id: string
  kind: EventKind
  title: string
  amount: number | null              // facoltativo per i promemoria; nella valuta dell'utente
  category: string | null            // per i pagamenti: la categoria con cui entra nel budget
  date: string                       // "YYYY-MM-DD": la prima volta
  repeat: Repeat | null              // null = una volta sola
  until: string | null               // "YYYY-MM-DD": l'ultima volta possibile (es. l'ultima rata); null = senza fine
  done: string[]                     // le volte segnate come fatte ("YYYY-MM-DD")
  active: boolean
  time?: string | null               // "HH:MM" facoltativa: serve ai promemoria "N ore prima"
  reminders?: Reminder[]             // quando avvisare (engine/reminders)
  nag?: boolean                      // ripeti ogni giorno finché non è segnato come fatto
  goalId?: string | null             // versamento (kind 'saving') verso un obiettivo: "fatto" lo aggiunge all'obiettivo; senza = fondo di emergenza
  service?: string | null            // abbonamento dal catalogo (content/services): monogramma e categoria
  method?: string | null             // come si paga (solo un'etichetta: carta, conto, PayPal…)
  prices?: PriceChange[]             // storico dei prezzi: ogni volta che l'importo cambia
  doc?: DocInfo | null               // documento (kind 'document'): la data dell'evento è la scadenza
}

/** Documenti con scadenza: carta d'identità, patente, assicurazioni… Nessuna scansione e nessun numero (scelta di Carlo, 17/10). */
export type DocCategory = 'personal' | 'car' | 'home' | 'health' | 'work' | 'other'
export const DOC_CATEGORIES: DocCategory[] = ['personal', 'car', 'home', 'health', 'work', 'other']
export interface DocInfo { category: DocCategory; renewals?: string[] }   // renewals: le scadenze di prima, dalla più vecchia
/** Entro quanti giorni un documento è "in scadenza". */
export const DOC_SOON = 60

export interface DocStatus { state: 'ok' | 'soon' | 'expired'; days: number }
export function docStatus(e: Pick<CalEvent, 'date'>, today: string): DocStatus {
  const days = daysBetween(today, e.date)
  return { state: days < 0 ? 'expired' : days <= DOC_SOON ? 'soon' : 'ok', days }
}
/** Rinnovato: la vecchia scadenza va nella cronologia, la nuova diventa la data; si riparte da zero con i promemoria. */
export function renewDoc(e: CalEvent, newExpiry: string): CalEvent {
  const renewals = [...(e.doc?.renewals ?? []), e.date].slice(-20)
  return { ...e, date: newExpiry, done: [], doc: { category: e.doc?.category ?? 'other', renewals } }
}

/** Come si paga: solo un'etichetta per ricordarselo (nessun collegamento alla banca). */
export const PAY_METHODS = ['card', 'account', 'paypal', 'applepay', 'googlepay', 'satispay', 'cash'] as const

export interface PriceChange { date: string; from: number; to: number }

/** Quante volte in un anno si ripete (0 se una volta sola). */
export function timesPerYear(r: Repeat | null): number {
  if (!r) return 0
  return r.unit === 'day' ? 365 / r.every : r.unit === 'week' ? 52 / r.every : r.unit === 'month' ? 12 / r.every : 1 / r.every
}
/** Quanto costa in un anno, al prezzo di oggi. */
export const yearlyCost = (e: Pick<CalEvent, 'amount' | 'repeat'>) => Math.round((e.amount ?? 0) * timesPerYear(e.repeat) * 100) / 100

/** L'evento salvato con lo storico del prezzo aggiornato, se l'importo è cambiato rispetto a prima (al massimo 24 cambi). */
export function withPriceChange(prev: CalEvent | undefined, next: CalEvent, today: string): CalEvent {
  if (!prev || prev.amount == null || next.amount == null || prev.amount === next.amount) return next
  return { ...next, prices: [...(next.prices ?? prev.prices ?? []), { date: today, from: prev.amount, to: next.amount }].slice(-24) }
}

export const presetOf = (r: Repeat | null): RepeatPreset | 'once' | 'custom' => {
  if (!r) return 'once'
  const hit = (Object.keys(REPEAT_PRESETS) as RepeatPreset[]).find(k => REPEAT_PRESETS[k].every === r.every && REPEAT_PRESETS[k].unit === r.unit)
  return hit ?? 'custom'
}

/** La n-esima volta (0 = la prima). Mesi e anni tengono il giorno di partenza: il 31 diventa l'ultimo giorno dei mesi corti. */
export function nth(e: Pick<CalEvent, 'date' | 'repeat'>, n: number): string {
  if (!e.repeat || n === 0) return e.date
  const { every, unit } = e.repeat
  if (unit === 'day' || unit === 'week') return addDays(e.date, n * every * (unit === 'week' ? 7 : 1))
  const { year, month, day } = parseDate(e.date)
  const m = month + n * every * (unit === 'year' ? 12 : 1)
  const last = parseDate(makeDate(year, m + 1, 0)).day
  return makeDate(year, m, Math.min(day, last))
}

/** Le volte in cui l'evento cade tra `from` e `to` (comprese). */
export function occurrences(e: Pick<CalEvent, 'date' | 'repeat' | 'until'>, from: string, to: string): string[] {
  const end = e.until && e.until < to ? e.until : to
  if (e.date > end) return []
  if (!e.repeat) return e.date >= from ? [e.date] : []
  // si salta subito vicino a `from`, poi si va avanti una volta alla volta
  const { every, unit } = e.repeat
  if (!Number.isInteger(every) || every < 1) return []
  const a = parseDate(e.date), b = parseDate(from)
  const distance = unit === 'month' || unit === 'year'
    ? (b.year - a.year) * 12 + b.month - a.month : daysBetween(e.date, from)
  const step = every * (unit === 'year' ? 12 : unit === 'week' ? 7 : 1)
  let n = Math.max(0, Math.floor(distance / step) - 1)
  const out: string[] = []
  for (let d = nth(e, n); d <= end && out.length < 400; d = nth(e, ++n)) if (d >= from) out.push(d)
  return out
}

/** La prossima volta da oggi compreso, o null se l'evento è finito. */
export function nextOccurrence(e: CalEvent, today: string): string | null {
  return occurrences(e, today, addDays(today, 366 * 5))[0] ?? null
}

/** La data dell'ultima volta se l'evento si ripete `count` volte dalla prima (rate: "ne restano 12"). */
export const untilAfterCount = (e: Pick<CalEvent, 'date' | 'repeat'>, count: number) => nth(e, Math.max(0, count - 1))

/** Quante volte restano da `from` compreso fino alla fine; null se senza fine. */
export function remainingCount(e: CalEvent, from: string): number | null {
  if (!e.until) return null
  return occurrences(e, from, e.until).length
}

/** Gli eventi che entrano nel budget come spese: attivi, in uscita, con importo e una categoria di spesa che esiste. */
export function budgetEvents(s: Settings): CalEvent[] {
  return s.events.filter(e => e.active && KIND_SIDE[e.kind] === 'out' && e.amount != null && e.amount > 0 && e.title.trim() &&
    s.categories.some(c => c.id === e.category && c.type !== 'income'))
}

/** Le volte di ogni evento attivo in un intervallo, in ordine di data: quello che il calendario mostra. */
export function agenda(events: CalEvent[], from: string, to: string): { date: string; event: CalEvent; done: boolean }[] {
  return events.filter(e => e.active)
    .flatMap(e => occurrences(e, from, to).map(date => ({ date, event: e, done: e.done.includes(date) })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.event.title.localeCompare(b.event.title))
}

/**
 * Un vecchio "pagamento ricorrente" (fino allo schema 4: ogni mese, un giorno, fino a un mese) come evento mensile.
 * La prima volta cade nel primo mese tracciato, con la stessa regola di allora (giorno prima dell'inizio del periodo = mese dopo).
 */
export function fromRecurring(r: Recurring, s: { monthStartDay: number; firstMonth: YearMonth }, id: string): CalEvent {
  const st = parseDate(periodOf(s.firstMonth, s.monthStartDay).start)
  const day = r.day ?? s.monthStartDay
  const date = makeDate(st.year, st.month + (day < st.day ? 1 : 0), Math.min(day, parseDate(makeDate(st.year, st.month + (day < st.day ? 2 : 1), 0)).day))
  const [uy, um] = (r.until ?? '').split('-').map(Number)
  return {
    id, kind: r.category === 'rent' ? 'rent' : r.category === 'loans' ? 'loan' : 'payment', title: r.name,
    amount: r.amount, category: r.category, date, repeat: { every: 1, unit: 'month' },
    until: r.until ? periodOf({ year: uy, month: um }, s.monthStartDay).end : null, done: [], active: r.active,
  }
}

/** Prefisso degli eventi che il calendario ricava dagli obiettivi (non si salvano: si toccano per aprire l'obiettivo). */
export const GOAL_EVENT = 'goal:'

/**
 * Le scadenze degli obiettivi non ancora raggiunti, come eventi da mostrare (l'ultimo giorno del mese scelto),
 * con un promemoria una settimana prima. `title` dà il testo nella lingua dell'utente.
 */
export function goalEvents(goals: Goal[] | undefined, today: string, title: (name: string) => string): CalEvent[] {
  return (goals ?? []).filter(g => !g.removed && g.deadline && !goalStatus(g, today).done).map(g => {
    const [y, m] = g.deadline!.split('-').map(Number)
    return { id: GOAL_EVENT + g.id, kind: 'reminder', title: title(g.name), amount: null, category: null, date: makeDate(y, m + 1, 0),
      repeat: null, until: null, done: [], active: true, reminders: [{ days: 7 }] }
  })
}

/** L'id del versamento segnato in un obiettivo da un evento del calendario: uno per ogni volta, così si può anche togliere. */
export const goalContributionId = (eventId: string, date: string) => `ev-${eventId}-${date}`

/** Il colore di un evento nel calendario: uscite, entrate, risparmi e investimenti, promemoria. */
export type Tone = 'out' | 'in' | 'save' | 'note'
export const toneOf = (k: EventKind): Tone =>
  k === 'saving' || k === 'pac' ? 'save' : KIND_SIDE[k] === 'in' ? 'in' : KIND_SIDE[k] === 'out' ? 'out' : 'note'

export interface PeriodSummary {
  income: number          // entrate previste
  out: number             // uscite previste (pagamenti, risparmi e investimenti)
  paid: number            // uscite confermate: solo le volte segnate come fatte (mai dedotte dalla data)
  toPay: number           // uscite non ancora confermate: future e scadute
  toConfirm: number       // di cui con la data già arrivata (oggi compreso) ma non segnate come fatte
  overdue: number         // di cui scadute e da seguire "finché non è fatto" (nag) ma non ancora segnate
  load: Record<string, number>   // uscite per giorno
  heavy: string[]         // i giorni più pesanti (al massimo 3, ognuno almeno il 15% delle uscite)
}

/** I conti di un intervallo del calendario (di solito un mese) a partire dalle voci di agenda(). */
export function periodSummary(items: { date: string; event: CalEvent; done: boolean }[], today: string): PeriodSummary {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const s: PeriodSummary = { income: 0, out: 0, paid: 0, toPay: 0, toConfirm: 0, overdue: 0, load: {}, heavy: [] }
  for (const x of items) {
    const a = x.event.amount ?? 0
    if (!a) continue
    const side = KIND_SIDE[x.event.kind]
    if (side === 'in') { s.income += a; continue }
    if (side !== 'out') continue
    s.out += a
    s.load[x.date] = (s.load[x.date] ?? 0) + a
    // «già pagato» è solo ciò che è stato confermato: il budget conta l'uscita dal suo giorno (per non sembrare più ricco),
    // ma il calendario non deve far credere pagata una rata o una bolletta che nessuno ha segnato come fatta
    if (x.done) { s.paid += a; continue }
    s.toPay += a
    if (x.date <= today) s.toConfirm += a
    if (x.date < today && x.event.nag) s.overdue += a
  }
  s.heavy = Object.entries(s.load).filter(([, v]) => v >= s.out * 0.15).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d)
  for (const k of ['income', 'out', 'paid', 'toPay', 'toConfirm', 'overdue'] as const) s[k] = r2(s[k])
  return s
}

/** L'ultimo aumento di prezzo dell'ultimo anno, in percentuale (null se non ce ne sono). */
export function recentIncrease(e: Pick<CalEvent, 'prices'>, today: string): number | null {
  const last = [...(e.prices ?? [])].reverse().find(p => daysBetween(p.date, today) <= 365)
  return last && last.to > last.from && last.from > 0 ? Math.round((last.to / last.from - 1) * 100) : null
}
