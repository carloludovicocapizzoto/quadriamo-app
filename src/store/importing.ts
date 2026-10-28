// Import dell'estratto conto: niente righe già viste, categorie proposte, possibili doppioni con i movimenti a mano.
import { daysBetween, normalize, suggest, type ImportRow, type Transaction } from '../engine'
import { newId } from './model'
import type { AppData, InboxItem } from './types'

const fingerprintOf = (r: { date: string; amount: number; description: string }) =>
  `${r.date}|${r.amount.toFixed(2)}|${normalize(r.description)}`

/** Prepara l'import: scarta le righe già viste (in casella, confermate o ignorate) e propone categoria e bucket. */
export function planImport(d: AppData, rows: ImportRow[], source = 'csv'): { items: InboxItem[]; duplicates: number } {
  const seen = new Set([...(d.inbox ?? []).map(i => i.fingerprint), ...Object.keys(d.importDone ?? {})])
  const occurrences = new Map<string, number>()
  const items: InboxItem[] = []
  let duplicates = 0
  for (const r of rows) {
    const base = fingerprintOf(r)
    const occurrence = (occurrences.get(base) ?? 0) + 1
    occurrences.set(base, occurrence)
    // Preserve legitimate repeated-looking bank rows, while giving each occurrence
    // a stable key so importing the same statement again remains idempotent.
    const fp = occurrence === 1 ? base : `${base}|occurrence:${occurrence}`
    if (seen.has(fp)) { duplicates++; continue }
    seen.add(fp)
    const sug = suggest(r.description, r.amount, d.settings)
    items.push({ id: newId(), fingerprint: fp, date: r.date, description: r.description, amount: r.amount,
                 currency: r.currency && r.currency !== d.settings.currency ? r.currency : null,
                 category: sug.category, paidFrom: sug.paidFrom, source })
  }
  return { items, duplicates }
}

/**
 * Righe importate che forse sono già tra i movimenti (es. inserite a mano): stesso importo, stessa direzione,
 * stessa valuta, data entro ±3 giorni (le carte contabilizzano spesso dopo). Ogni movimento copre al massimo una riga.
 */
export function duplicateCandidates(d: AppData, maxDays = 3): Map<string, Transaction> {
  const out = new Map<string, Transaction>()
  const used = new Set<string>()
  const base = d.settings.currency
  const isIncome = (t: Transaction) => d.settings.categories.find(c => c.id === t.category)?.type === 'income'
  const items = [...(d.inbox ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  for (const i of items) {
    let best: Transaction | null = null, bestGap = Infinity
    for (const t of d.transactions) {
      if (used.has(t.id) || t.amount == null || !t.date) continue
      if (Math.abs(t.amount - Math.abs(i.amount)) > 0.005) continue
      if ((t.currency || base) !== (i.currency || base)) continue
      if (t.category && isIncome(t) !== i.amount > 0) continue
      const gap = Math.abs(daysBetween(t.date, i.date))
      if (gap <= maxDays && gap < bestGap) { best = t; bestGap = gap }
    }
    if (best) { out.set(i.id, best); used.add(best.id) }
  }
  return out
}
