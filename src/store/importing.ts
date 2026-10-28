// Import dell'estratto conto: niente righe già viste, categorie proposte, possibili doppioni con i movimenti a mano.
import { daysBetween, minorDigits, normalize, suggest, type ImportRow, type Transaction } from '../engine'
import { newId } from './model'
import type { AppData, InboxItem } from './types'

/**
 * L'impronta moderna include data, importo alla precisione della valuta, descrizione e valuta estera.
 * Le chiavi storiche non specificavano la valuta, perciò restano possibili corrispondenze da confermare.
 */
function fingerprints(r: { date: string; amount: number; description: string; currency: string | null }, base: string) {
  const currency = r.currency && r.currency !== base ? r.currency : null
  const text = normalize(r.description)
  const current = `${r.date}|${r.amount.toFixed(Math.max(2, minorDigits(currency ?? base)))}|${text}${currency ? `|${currency}` : ''}`
  // la vecchia impronta (due decimali, senza valuta) vale solo per riconoscere ciò che era già stato importato
  const legacy = `${r.date}|${r.amount.toFixed(2)}|${text}`
  // Le fingerprint base a due decimali coincidono con lo schema legacy: marca le nuove per distinguerle.
  // Gli esatti esteri e a precisione maggiore restano compatibili con quelli già scritti dalla PR #11.
  return { exact: current === legacy ? `v2|${current}` : current, current, legacy }
}

/** Prepara l'import: scarta le righe già viste (in casella, confermate o ignorate) e propone categoria e bucket. */
export function planImport(d: AppData, rows: ImportRow[], source = 'csv'): { items: InboxItem[]; duplicates: number } {
  const before = new Set([...(d.inbox ?? []).map(i => i.fingerprint), ...Object.keys(d.importDone ?? {})])
  // Una voce già in inbox porta anche valuta e precisione: se il suo fingerprint era legacy,
  // ricalcolarlo evita di riproporre come candidato lo stesso movimento ancora da decidere.
  const inboxExact = new Set((d.inbox ?? []).map(i => fingerprints(i, d.settings.currency).exact))
  const seen = new Set(before)
  for (const fp of inboxExact) seen.add(fp)
  const occurrences = new Map<string, number>()
  const items: InboxItem[] = []
  let duplicates = 0
  for (const r of rows) {
    const { exact, current, legacy } = fingerprints(r, d.settings.currency)
    const occurrence = (occurrences.get(exact) ?? 0) + 1
    occurrences.set(exact, occurrence)
    // Preserve legitimate repeated-looking bank rows, while giving each occurrence
    // a stable key so importing the same statement again remains idempotent.
    const nth = (k: string) => (occurrence === 1 ? k : `${k}|occurrence:${occurrence}`)
    const fp = nth(exact)
    // la vecchia impronta si confronta solo con quanto c'era prima di questo import, mai con le righe dello stesso file
    if (seen.has(fp) || (current !== legacy && before.has(nth(current)))) { duplicates++; continue }
    seen.add(fp)
    const sug = suggest(r.description, r.amount, d.settings)
    const legacyCandidate = before.has(nth(legacy))
    items.push({ id: newId(), fingerprint: fp, date: r.date, description: r.description, amount: r.amount,
                 currency: r.currency && r.currency !== d.settings.currency ? r.currency : null,
                 category: sug.category, paidFrom: sug.paidFrom, source, ...(legacyCandidate ? { legacyCandidate: true } : {}) })
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
