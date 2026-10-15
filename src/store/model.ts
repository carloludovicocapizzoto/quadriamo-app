// Mattoni comuni del modello: identificativi, primo mese tracciato, dati di partenza.
import { compareYm, defaultSettings, monthOf, type Settings, type Transaction, type YearMonth } from '../engine'
import type { AppData } from './types'

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Se un movimento è più vecchio del primo mese tracciato, il primo mese si sposta indietro. */
export function widenFirstMonth(s: Settings, tx: Transaction): Settings {
  if (!tx.date) return s
  const ym = monthOf(tx.date, s.monthStartDay)
  return compareYm(ym, s.firstMonth) < 0 ? { ...s, firstMonth: ym } : s
}

export function createInitial(currency: string, today: string, monthStartDay = 1): AppData {
  const firstMonth: YearMonth = monthOf(today, monthStartDay)
  const settings = defaultSettings({ currency, firstMonth })
  settings.monthStartDay = monthStartDay
  return { version: 1, settings, transactions: [] }
}
