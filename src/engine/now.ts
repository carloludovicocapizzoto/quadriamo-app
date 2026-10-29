// "Adesso": cosa conta oggi, in ordine di urgenza. Solo regole (nessuna IA, scelta di Carlo): prima quello che va fatto
// (pagamenti da seguire scaduti, scadenze di oggi, documenti scaduti), poi quello che arriva (prossima uscita, prossima
// entrata, documenti in scadenza) e le anomalie (spese già oltre i soldi del mese, una categoria molto sopra il solito,
// un abbonamento aumentato). Pochi elementi e utili: la Home ne mostra tre, gli altri a richiesta.
import { addDays, daysBetween } from './dates'
import { agenda, docStatus, KIND_SIDE, type CalEvent } from './calendar'
import { goalStatus, type Goal } from './goals'
import type { CategoryChange } from './reports'
import type { YearMonth } from './types'

export type NowItem =
  | { type: 'late'; event: CalEvent; date: string; days: number }               // da seguire "finché non è fatto", già scaduto
  | { type: 'today'; events: CalEvent[]; amount: number }                       // pagamenti di oggi
  | { type: 'docExpired'; event: CalEvent; days: number }
  | { type: 'over'; amount: number; planned: boolean }                          // le spese hanno già superato i soldi (o il previsto): un fatto
  | { type: 'doc'; event: CalEvent; days: number }                              // documento in scadenza
  | { type: 'nextOut'; event: CalEvent; date: string; days: number }
  | { type: 'price'; event: CalEvent; pct: number; yearly: number }             // abbonamento aumentato nell'ultimo mese
  | { type: 'category'; change: CategoryChange }                                // categoria molto sopra la media
  | { type: 'nextIn'; event: CalEvent; date: string; days: number }
  | { type: 'log' }                                                             // la sera, se oggi non hai segnato niente
  | { type: 'goal'; goal: Goal; days: number; left: number }                    // obiettivo in scadenza e indietro
  | { type: 'receipt'; ym: YearMonth }                                          // nei primi giorni: la ricevuta del mese finito

/**
 * Quelli che chiedono di fare qualcosa oggi (per il titolo: "Oggi hai N cose da fare"). I pagamenti di oggi solo se
 * vanno fatti a mano: da seguire finché non sono fatti, scadenze fiscali, promemoria (gli addebiti automatici no).
 */
export const isActionable = (x: NowItem) => x.type === 'late' || x.type === 'docExpired' || x.type === 'log' ||
  (x.type === 'today' && x.events.some(e => e.nag || e.kind === 'tax' || e.kind === 'reminder'))

export interface NowInput {
  events: CalEvent[]
  goals?: Goal[]
  today: string
  hour: number                     // ora locale (per il promemoria serale)
  loggedToday: boolean
  over?: { amount: number; planned: boolean } | null   // quanto le spese hanno già superato le parti di spesa (spend.overspent)
  changes?: CategoryChange[]       // categorie rispetto alla media (reports.categoryChanges)
  receipt?: YearMonth | null       // il mese appena finito, se ha movimenti e siamo nei primi giorni del nuovo
}

export function nowItems(i: NowInput): NowItem[] {
  const { today } = i
  const out: NowItem[] = []
  const active = i.events.filter(e => e.active)
  const outs = (from: string, to: string) => agenda(active, from, to).filter(x => KIND_SIDE[x.event.kind] === 'out' && !x.done)

  for (const x of outs(addDays(today, -7), addDays(today, -1)).filter(x => x.event.nag))
    out.push({ type: 'late', event: x.event, date: x.date, days: daysBetween(x.date, today) })
  const todays = outs(today, today)
  if (todays.length) out.push({ type: 'today', events: todays.map(x => x.event), amount: todays.reduce((a, x) => a + (x.event.amount ?? 0), 0) })

  for (const e of active.filter(e => e.kind === 'document')) {
    const s = docStatus(e, today)
    if (s.state === 'expired') out.push({ type: 'docExpired', event: e, days: -s.days })
    else if (s.days <= 30) out.push({ type: 'doc', event: e, days: s.days })
  }
  if (i.over && i.over.amount > 0) out.push({ type: 'over', amount: i.over.amount, planned: i.over.planned })

  const next = outs(addDays(today, 1), addDays(today, 7))[0]
  if (next) out.push({ type: 'nextOut', event: next.event, date: next.date, days: daysBetween(today, next.date) })

  for (const e of active.filter(e => e.kind === 'subscription' && e.prices?.length)) {
    const p = e.prices![e.prices!.length - 1]
    if (p.to > p.from && p.from > 0 && daysBetween(p.date, today) <= 30) {
      const times = e.repeat ? (e.repeat.unit === 'year' ? 1 / e.repeat.every : e.repeat.unit === 'month' ? 12 / e.repeat.every : e.repeat.unit === 'week' ? 52 / e.repeat.every : 365 / e.repeat.every) : 0
      out.push({ type: 'price', event: e, pct: Math.round((p.to / p.from - 1) * 100), yearly: Math.round((p.to - p.from) * times * 100) / 100 })
    }
  }
  const big = (i.changes ?? []).find(c => c.pct != null && c.pct >= 50 && c.diff >= 20)
  if (big) out.push({ type: 'category', change: big })

  const income = agenda(active, today, addDays(today, 14)).find(x => KIND_SIDE[x.event.kind] === 'in' && !x.done)
  if (income) out.push({ type: 'nextIn', event: income.event, date: income.date, days: daysBetween(today, income.date) })

  if (!i.loggedToday && i.hour >= 18) out.push({ type: 'log' })

  for (const g of i.goals ?? []) {
    if (g.removed || !g.deadline) continue
    const s = goalStatus(g, today)
    const [y, m] = g.deadline.split('-').map(Number)
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const days = daysBetween(today, end)
    if (!s.done && s.onTrack === false && days >= 0 && days <= 45) out.push({ type: 'goal', goal: g, days, left: s.left })
  }

  if (i.receipt) out.push({ type: 'receipt', ym: i.receipt })

  const rank: Record<NowItem['type'], number> = { late: 0, today: 1, docExpired: 2, over: 3, doc: 4, nextOut: 5, price: 6, receipt: 6.5, category: 7, nextIn: 8, log: 9, goal: 10 }
  // un documento a pochi giorni conta più della prossima uscita
  const score = (x: NowItem) => x.type === 'doc' && x.days > 14 ? 7.5 : rank[x.type]
  return out.sort((a, b) => score(a) - score(b))
}
