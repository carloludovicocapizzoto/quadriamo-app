// Stato dell'app e sue modifiche: funzioni pure, testate in state.test.ts.
import { compareYm, defaultSettings, monthOf, type Investments, type Settings, type Transaction, type YearMonth } from '../engine'

export interface AppData {
  version: 1
  settings: Settings
  transactions: Transaction[]
  demo?: boolean                      // dati di esempio: l'app propone di ripartire da zero, non si sincronizzano
  settingsUpdatedAt?: string          // ISO, ultima modifica delle impostazioni
  deleted?: Record<string, string>    // id movimento eliminato -> quando (per non farlo "risorgere" da un altro dispositivo)
  investments?: Investments
  investmentsUpdatedAt?: string
}

export type Action =
  | { type: 'load'; data: AppData | null }
  | { type: 'addTx'; tx: Transaction; at?: string }
  | { type: 'updateTx'; tx: Transaction; at?: string }
  | { type: 'deleteTx'; id: string; at?: string }
  | { type: 'setSettings'; settings: Settings; at?: string }
  | { type: 'setInvestments'; investments: Investments; at?: string }
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
  const at = a.at ?? new Date().toISOString()
  switch (a.type) {
    case 'addTx': {
      const tx = { ...a.tx, updatedAt: at }
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, tx), transactions: [...d.transactions, tx] } }
    }
    case 'updateTx': {
      const tx = { ...a.tx, updatedAt: at }
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, tx),
                                 transactions: d.transactions.map(t => t.id === tx.id ? tx : t) } }
    }
    case 'deleteTx':
      return { ...state, data: { ...d, transactions: d.transactions.filter(t => t.id !== a.id),
                                 deleted: { ...d.deleted, [a.id]: at } } }
    case 'setSettings':
      return { ...state, data: { ...d, settings: a.settings, settingsUpdatedAt: at } }
    case 'setInvestments':
      return { ...state, data: { ...d, investments: a.investments, investmentsUpdatedAt: at } }
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
  return { version: 1, settings: { fxRates: {}, ...d.settings }, transactions: d.transactions,
           deleted: d.deleted ?? {}, settingsUpdatedAt: d.settingsUpdatedAt,
           ...(d.investments ? { investments: d.investments, investmentsUpdatedAt: d.investmentsUpdatedAt } : {}) }
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

/**
 * Unisce i dati di due dispositivi: per ogni movimento vince la modifica più recente,
 * le eliminazioni più recenti della modifica vincono, per le impostazioni vince la versione più recente.
 */
export function mergeData(a: AppData, b: AppData): AppData {
  const deleted: Record<string, string> = { ...a.deleted }
  for (const [id, at] of Object.entries(b.deleted ?? {})) if (!deleted[id] || at > deleted[id]) deleted[id] = at

  const byId = new Map<string, Transaction>()
  for (const tx of [...a.transactions, ...b.transactions]) {
    const prev = byId.get(tx.id)
    if (!prev || (tx.updatedAt ?? '') > (prev.updatedAt ?? '')) byId.set(tx.id, tx)
  }
  const transactions = [...byId.values()].filter(tx => !(deleted[tx.id] && deleted[tx.id] >= (tx.updatedAt ?? '')))

  const newerSettings = (b.settingsUpdatedAt ?? '') > (a.settingsUpdatedAt ?? '')
  let settings = newerSettings ? b.settings : a.settings
  for (const tx of transactions) settings = widenFirstMonth(settings, tx)

  const newerInv = (b.investmentsUpdatedAt ?? '') > (a.investmentsUpdatedAt ?? '')
  const investments = newerInv ? b.investments : (a.investments ?? b.investments)
  return {
    version: 1, settings, transactions, deleted,
    settingsUpdatedAt: newerSettings ? b.settingsUpdatedAt : a.settingsUpdatedAt,
    ...(investments ? { investments, investmentsUpdatedAt: newerInv ? b.investmentsUpdatedAt : a.investmentsUpdatedAt } : {}),
  }
}

/** Esporta i movimenti in CSV (separatore ";" e virgola decimale non servono: Excel/Sheets leggono il punto se indicato). */
export function toCsv(d: AppData, names: { category: (id: string | null) => string; bucket: (id: string | null) => string }): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [['date', 'description', 'category', 'amount', 'currency', 'paid_from'].join(',')]
  const sorted = [...d.transactions].sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''))
  for (const t of sorted) {
    rows.push([t.date, t.description, names.category(t.category), t.amount, t.currency || d.settings.currency,
               t.paidFrom ? names.bucket(t.paidFrom) : ''].map(esc).join(','))
  }
  return rows.join('\n') + '\n'
}
