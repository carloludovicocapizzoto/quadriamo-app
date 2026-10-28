// Import dell'estratto conto: niente righe già viste, categorie proposte, possibili doppioni con i movimenti a mano.
import { daysBetween, minorDigits, normalize, suggest, type ImportRow, type Transaction } from '../engine'
import { newId } from './model'
import type { AppData, InboxItem } from './types'

/**
 * Le impronte di una riga (data, importo, descrizione):
 * - `full`: con tutte le cifre della valuta e sempre la valuta. Non si confonde mai.
 * Le nuove decisioni salvano sempre `full`, anche nella valuta di base.
 * - `legacy`: quella delle versioni precedenti (due decimali, senza valuta). Da sola non prova che sia lo stesso movimento.
 */
function fingerprints(r: { date: string; amount: number; description: string; currency: string | null }, base: string) {
  const currency = r.currency && r.currency !== base ? r.currency : null
  const digits = Math.max(2, minorDigits(currency ?? base)), text = normalize(r.description)
  const legacy = `${r.date}|${r.amount.toFixed(2)}|${text}`
  const full = `${r.date}|${r.amount.toFixed(digits)}|${text}|${currency ?? base}`
  return { full, legacy }
}
const occurrenceOf = (fp: string) => /\|occurrence:\d+$/.exec(fp)?.[0] ?? ''

/**
 * Prepara l'import: scarta le righe già viste (in casella, confermate o ignorate) e propone categoria e bucket.
 * Una riga che combacia solo con un'impronta vecchia, senza la prova che sia lo stesso movimento, non si scarta:
 * entra nella casella come «forse già importato» (maybeImported), e l'utente la aggiunge o la ignora.
 */
export function planImport(d: AppData, rows: ImportRow[], source = 'csv'): { items: InboxItem[]; duplicates: number } {
  const base = d.settings.currency
  const done = new Set(Object.keys(d.importDone ?? {}))
  // in casella c'è ancora la riga intera: si confronta con la sua impronta completa, ricalcolata, non con quella salvata
  const inboxFull = new Set((d.inbox ?? []).map(i => fingerprints(i, base).full + occurrenceOf(i.fingerprint)))
  const occurrences = new Map<string, number>()
  const items: InboxItem[] = []
  let duplicates = 0
  for (const r of rows) {
    const { full, legacy } = fingerprints(r, base)
    const occurrence = (occurrences.get(full) ?? 0) + 1
    occurrences.set(full, occurrence)
    // Preserve legitimate repeated-looking bank rows, while giving each occurrence
    // a stable key so importing the same statement again remains idempotent.
    const nth = (k: string) => (occurrence === 1 ? k : `${k}|occurrence:${occurrence}`)
    const same = inboxFull.has(nth(full)) || done.has(nth(full))
    if (same) { duplicates++; continue }
    const maybe = done.has(nth(legacy))
    // l'impronta salvata non deve coincidere con una vecchia di un altro movimento (la sincronizzazione le unirebbe)
    const fp = nth(full)
    const sug = suggest(r.description, r.amount, d.settings)
    items.push({ id: newId(), fingerprint: fp, date: r.date, description: r.description, amount: r.amount,
                 currency: r.currency && r.currency !== base ? r.currency : null,
                 category: sug.category, paidFrom: sug.paidFrom, source, ...(maybe ? { maybeImported: true as const } : {}) })
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
