// Il calendario finanziario: tutto ciò che succederà, in un solo concetto, l'evento. Affitto, bollette, rate, mutuo,
// abbonamenti, stipendio, dividendi, cedole, scadenze fiscali, promemoria liberi. Un evento può ripetersi (ogni N giorni,
// settimane, mesi o anni) e può avere una fine. Gli eventi di spesa con importo e categoria entrano nel budget del mese
// come facevano i "pagamenti ricorrenti" (month.ts, recurringOf): stessi conti, una fonte sola.
import { addDays, daysBetween, makeDate, parseDate, periodOf } from './dates'
import { goalStatus, type Goal } from './goals'
import type { Reminder } from './reminders'
import type { Recurring, Settings, YearMonth } from './types'

export type EventKind = 'rent' | 'bill' | 'loan' | 'mortgage' | 'subscription' | 'payment' | 'saving' | 'pac'
  | 'salary' | 'income' | 'dividend' | 'coupon' | 'tax' | 'reminder'

/** In uscita (pagamenti) o in entrata: decide colore, segno e se può entrare nel budget come spesa. */
export const KIND_SIDE: Record<EventKind, 'out' | 'in' | 'none'> = {
  rent: 'out', bill: 'out', loan: 'out', mortgage: 'out', subscription: 'out', payment: 'out', saving: 'out', pac: 'out', tax: 'out',
  salary: 'in', income: 'in', dividend: 'in', coupon: 'in', reminder: 'none',
}
export const EVENT_KINDS = Object.keys(KIND_SIDE) as EventKind[]

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
  const step = e.repeat.unit === 'day' ? e.repeat.every : e.repeat.unit === 'week' ? e.repeat.every * 7
    : e.repeat.unit === 'month' ? e.repeat.every * 28 : e.repeat.every * 365
  let n = Math.max(0, Math.floor(daysBetween(e.date, from) / step) - 1)
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
