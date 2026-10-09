import type { YearMonth } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Come DATE() di Excel: mesi e giorni fuori intervallo scorrono nel mese/anno successivo. */
export function makeDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function parseDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseDate(iso)
  return makeDate(year, month, day + days)
}

export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(a + 'T00:00:00Z'), tb = Date.parse(b + 'T00:00:00Z')
  return Math.round((tb - ta) / 86_400_000)
}

export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parseDate(iso)
  return makeDate(year, month + months, day)
}

/** Periodo del mese: con inizio al giorno 1 è il mese di calendario, altrimenti dal giorno X del mese prima. */
export function periodOf(ym: YearMonth, startDay: number): { start: string; end: string } {
  const k = startDay === 1 ? 0 : 1
  const start = makeDate(ym.year, ym.month - k, startDay)
  const end = addDays(makeDate(ym.year, ym.month + 1 - k, startDay), -1)
  return { start, end }
}

/** Mese a cui appartiene una data, dato il giorno di inizio. */
export function monthOf(iso: string, startDay: number): YearMonth {
  const { year, month, day } = parseDate(iso)
  if (startDay !== 1 && day >= startDay) {
    const next = parseDate(makeDate(year, month + 1, 1))
    return { year: next.year, month: next.month }
  }
  return { year, month }
}

export const ymKey = (ym: YearMonth) => `${ym.year}-${pad(ym.month)}`

export function prevMonth(ym: YearMonth): YearMonth {
  return ym.month === 1 ? { year: ym.year - 1, month: 12 } : { year: ym.year, month: ym.month - 1 }
}

export function compareYm(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || a.month - b.month
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
