// Stato dell'app e sue modifiche: funzioni pure, testate in state.test.ts.
import { compareYm, defaultSettings, monthOf, type Settings, type Transaction, type YearMonth } from '../engine'

export interface AppData {
  version: 1
  settings: Settings
  transactions: Transaction[]
  demo?: boolean              // dati di esempio: l'app propone di ripartire da zero
}

export type Action =
  | { type: 'load'; data: AppData | null }
  | { type: 'addTx'; tx: Transaction }
  | { type: 'updateTx'; tx: Transaction }
  | { type: 'deleteTx'; id: string }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'replace'; data: AppData | null }

export interface State { loaded: boolean; data: AppData | null }

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Se un movimento è più vecchio del primo mese tracciato, il primo mese si sposta indietro. */
function widenFirstMonth(s: Settings, tx: Transaction): Settings {
  if (!tx.date) return s
  const ym = monthOf(tx.date, s.monthStartDay)
  return compareYm(ym, s.firstMonth) < 0 ? { ...s, firstMonth: ym } : s
}

export function reducer(state: State, a: Action): State {
  if (a.type === 'load') return { loaded: true, data: a.data }
  if (a.type === 'replace') return { ...state, data: a.data }
  const d = state.data
  if (!d) return state
  switch (a.type) {
    case 'addTx':
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, a.tx), transactions: [...d.transactions, a.tx] } }
    case 'updateTx':
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, a.tx),
                                 transactions: d.transactions.map(t => t.id === a.tx.id ? a.tx : t) } }
    case 'deleteTx':
      return { ...state, data: { ...d, transactions: d.transactions.filter(t => t.id !== a.id) } }
    case 'setSettings':
      return { ...state, data: { ...d, settings: a.settings } }
  }
}

export function createInitial(currency: string, today: string, monthStartDay = 1): AppData {
  const firstMonth: YearMonth = monthOf(today, monthStartDay)
  const settings = defaultSettings({ currency, firstMonth })
  settings.monthStartDay = monthStartDay
  return { version: 1, settings, transactions: [] }
}

export type SettingsError = 'sharesNot100' | 'bucketName' | 'startDay' | 'categoryName' | 'recurring'

export function validateSettings(s: Settings): SettingsError[] {
  const out: SettingsError[] = []
  const total = s.buckets.reduce((a, b) => a + b.share, 0)
  if (Math.abs(total - 1) > 0.0001) out.push('sharesNot100')
  if (s.buckets.some(b => !b.name.trim())) out.push('bucketName')
  if (!Number.isInteger(s.monthStartDay) || s.monthStartDay < 1 || s.monthStartDay > 28) out.push('startDay')
  if (s.categories.some(c => !c.name.trim())) out.push('categoryName')
  if (s.recurring.some(r => !r.name.trim() || !(r.amount > 0) || !s.categories.some(c => c.id === r.category) ||
                            (r.day != null && (r.day < 1 || r.day > 31)))) out.push('recurring')
  return out
}

/** Legge un backup JSON; lancia un errore se non è un backup valido di Quadriamo. */
export function parseBackup(text: string): AppData {
  const d = JSON.parse(text)
  const ok = d && d.version === 1 && d.settings && Array.isArray(d.settings.buckets) && d.settings.buckets.length === 4 &&
    Array.isArray(d.settings.categories) && Array.isArray(d.settings.recurring) && Array.isArray(d.transactions) &&
    typeof d.settings.currency === 'string' && d.settings.firstMonth &&
    d.transactions.every((t: Transaction) => typeof t.id === 'string' && typeof t.description === 'string')
  if (!ok) throw new Error('invalid backup')
  return { version: 1, settings: { fxRates: {}, ...d.settings }, transactions: d.transactions }
}

/** Parse di un importo scritto dall'utente: accetta "12,50", "12.50", "1.234,56", "1,234.56". */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s€$£¥]/g, '').replace(/[^\d.,-]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    const dec = lastComma > lastDot ? ',' : '.'
    s = s.split(dec === ',' ? '.' : ',').join('').replace(dec, '.')
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}
