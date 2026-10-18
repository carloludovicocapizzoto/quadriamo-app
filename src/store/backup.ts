// Backup (JSON) e esportazione dei movimenti (CSV).
import type { Transaction } from '../engine'
import type { AppData } from './types'

/** Legge un backup JSON; lancia un errore se non è un backup valido di Quadriamo. */
export function parseBackup(text: string): AppData {
  const d = JSON.parse(text)
  const ok = d && d.version === 1 && d.settings && Array.isArray(d.settings.buckets) && d.settings.buckets.length === 4 &&
    Array.isArray(d.settings.categories) && (Array.isArray(d.settings.events) || Array.isArray(d.settings.recurring)) && Array.isArray(d.transactions) &&
    typeof d.settings.currency === 'string' && d.settings.firstMonth &&
    d.transactions.every((t: Transaction) => typeof t.id === 'string' && typeof t.description === 'string')
  if (!ok) throw new Error('invalid backup')
  return { version: 1, settings: { fxRates: {}, ...d.settings }, transactions: d.transactions,
           ...(d.demo === true ? { demo: true } : {}),
           deleted: d.deleted ?? {}, settingsUpdatedAt: d.settingsUpdatedAt,
           ...(d.investments ? { investments: d.investments, investmentsUpdatedAt: d.investmentsUpdatedAt } : {}),
           inbox: d.inbox ?? [], importDone: d.importDone ?? {}, payday: d.payday ?? {},
           ...(d.profile ? { profile: d.profile, profileUpdatedAt: d.profileUpdatedAt } : {}),
           ...(Array.isArray(d.activity) ? { activity: d.activity } : {}),
           ...(Array.isArray(d.goals) ? { goals: d.goals } : {}) }
}

/** Esporta i movimenti in CSV (separatore ";" e virgola decimale non servono: Excel/Sheets leggono il punto se indicato). */
export function toCsv(d: AppData, names: { category: (id: string | null) => string; bucket: (id: string | null) => string }): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [['date', 'description', 'category', 'amount', 'currency', 'paid_from'].join(',')]
  const sorted = [...d.transactions].sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''))
  for (const t of sorted) {
    rows.push([t.date, t.description, names.category(t.category), t.amount, t.currency || d.settings.currency,
               t.paidFrom ? names.bucket(t.paidFrom) : ''].map(esc).join(','))
  }
  return rows.join('\n') + '\n'
}
