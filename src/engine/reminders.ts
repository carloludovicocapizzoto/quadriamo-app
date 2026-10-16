// Promemoria del calendario: quando avvisare, nel rispetto delle preferenze. Calcolati sul telefono per i prossimi giorni;
// al server arrivano solo l'ora e il nome dell'evento (mai gli importi), e lui li consegna. Pochi e utili:
// niente nelle ore di silenzio né nei giorni spenti (si sposta al primo momento libero), al massimo N al giorno
// (gli altri finiscono raggruppati nell'ultimo), e avvisi uguali alla stessa ora diventano uno solo.
import { addDays, daysBetween } from './dates'
import { occurrences, type CalEvent } from './calendar'

/** Quanto prima: N giorni (all'orario preferito), N ore prima dell'orario dell'evento, oppure un momento preciso. */
export type Reminder = { days: number } | { hours: number } | { at: string }   // at: "YYYY-MM-DDTHH:MM" (ora locale)
export const REMINDER_DAYS = [30, 14, 7, 3, 1, 0] as const
export const REMINDER_HOURS = [1, 2, 4] as const

export interface NotifyPrefs {
  reminders: boolean        // pagamenti, bollette, rate, scadenze
  morning: boolean          // ogni mattina: quanto puoi spendere oggi
  nudge: boolean            // se ti dimentichi di segnare le spese (missioni e slancio)
  news: boolean             // notizie principali
  hour: string              // "HH:MM": quando arrivano i promemoria "N giorni prima"
  quiet: { from: string; to: string } | null   // ore di silenzio, es. 22:00 → 08:00
  days: number[]            // giorni attivi: 1 = lunedì … 7 = domenica
  maxPerDay: number         // tetto giornaliero di promemoria
  email: boolean            // anche via email (arriverà con il dominio di Quadriamo)
}
export const DEFAULT_NOTIFY: NotifyPrefs = {
  reminders: true, morning: true, nudge: true, news: true, hour: '09:00', quiet: { from: '22:00', to: '08:00' },
  days: [1, 2, 3, 4, 5, 6, 7], maxPerDay: 3, email: false,
}

export interface Planned { at: string; date: string; titles: string[]; eventIds: string[] }   // at: "YYYY-MM-DDTHH:MM" locale

const NAG_DAYS = 7   // "finché non lo segno come fatto": un promemoria al giorno, al massimo per una settimana dopo la scadenza
const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const weekday = (iso: string) => ((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1

/** Il primo momento consentito da `at` in poi: fuori dalle ore di silenzio e in un giorno attivo. */
export function allowed(at: string, p: Pick<NotifyPrefs, 'quiet' | 'days'>): string {
  let [day, time] = at.split('T')
  for (let i = 0; i < 8; i++) {
    if (p.days.length && !p.days.includes(weekday(day))) { day = addDays(day, 1); time = p.quiet?.to ?? '08:00'; continue }
    if (p.quiet) {
      const t = minutes(time), from = minutes(p.quiet.from), to = minutes(p.quiet.to)
      const inQuiet = from > to ? t >= from || t < to : t >= from && t < to
      if (inQuiet) {
        if (from > to && t >= from) day = addDays(day, 1)
        time = p.quiet.to
        continue
      }
    }
    return `${day}T${time}`
  }
  return `${day}T${time}`
}

/** I promemoria da qui a `horizon` giorni, già spostati, uniti e con il tetto giornaliero. `now`: "YYYY-MM-DDTHH:MM" locale. */
export function planReminders(events: CalEvent[], p: NotifyPrefs, now: string, horizon = 45): Planned[] {
  if (!p.reminders) return []
  const today = now.slice(0, 10), end = addDays(today, horizon)
  const raw: { at: string; date: string; title: string; id: string }[] = []
  for (const e of events) {
    if (!e.active || !e.reminders?.length) continue
    // si guarda anche un po' indietro: per un evento tra 30 giorni il promemoria "30 giorni prima" cade oggi
    for (const date of occurrences(e, addDays(today, -NAG_DAYS), addDays(end, 31))) {
      if (e.done.includes(date)) continue
      for (const r of e.reminders) {
        const at = 'days' in r ? `${addDays(date, -r.days)}T${p.hour}`
          : 'hours' in r ? (e.time ? `${date}T${hhmm(Math.max(0, minutes(e.time) - r.hours * 60))}` : `${date}T${p.hour}`)
          : r.at.slice(0, 10) === date || !e.repeat ? r.at : null
        if (at) raw.push({ at, date, title: e.title, id: e.id })
      }
      // finché non è fatto: ogni giorno all'orario preferito, dalla scadenza per una settimana
      if (e.nag) for (let i = 1; i <= NAG_DAYS; i++) raw.push({ at: `${addDays(date, i)}T${p.hour}`, date, title: e.title, id: e.id })
    }
  }
  const byAt = new Map<string, Planned>()
  for (const x of raw) {
    const at = allowed(x.at, p)
    if (at < now || at.slice(0, 10) > end) continue
    const hit = byAt.get(at) ?? { at, date: x.date, titles: [], eventIds: [] }
    if (!hit.eventIds.includes(x.id)) { hit.titles.push(x.title); hit.eventIds.push(x.id) }
    if (x.date < hit.date) hit.date = x.date
    byAt.set(at, hit)
  }
  // tetto giornaliero: oltre il massimo, gli avvisi del giorno confluiscono nell'ultimo consentito
  const out: Planned[] = []
  const sorted = [...byAt.values()].sort((a, b) => a.at.localeCompare(b.at))
  for (const day of [...new Set(sorted.map(x => x.at.slice(0, 10)))]) {
    const list = sorted.filter(x => x.at.startsWith(day))
    const keep = list.slice(0, Math.max(1, p.maxPerDay))
    for (const extra of list.slice(keep.length)) {
      const last = keep[keep.length - 1]
      for (const [i, id] of extra.eventIds.entries()) if (!last.eventIds.includes(id)) { last.eventIds.push(id); last.titles.push(extra.titles[i]) }
    }
    out.push(...keep)
  }
  return out
}

/** Quanti giorni mancano (per il testo: "oggi", "domani", "tra 3 giorni"). */
export const daysUntil = (date: string, today: string) => daysBetween(today, date)
