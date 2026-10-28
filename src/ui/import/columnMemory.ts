// Le colonne scelte a mano per un tipo di file, ricordate su questo telefono per la volta dopo.
// Si salvano solo i titoli delle colonne (l'intestazione) e i numeri delle colonne: nessun importo, data o descrizione.
import type { ColumnMap } from '../../engine'

const KEY = 'q.importColumns.v1', MAX = 10
type Saved = Record<string, Pick<ColumnMap, 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'currency'>>

const signature = (header: string[]) => header.map(h => h.trim().toLowerCase()).join('|').slice(0, 500)

function read(): Saved {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v as Saved : {} } catch { return {} }
}

/** La scelta salvata per questa intestazione, solo se ancora coerente con il numero di colonne. */
export function savedColumns(header: string[]): ColumnMap | null {
  const m = read()[signature(header)]
  if (!m) return null
  const ok = (i: number | null) => i == null || (Number.isInteger(i) && i >= 0 && i < header.length)
  if (!ok(m.date) || !m.description?.every(ok) || !ok(m.amount) || !ok(m.debit) || !ok(m.credit) || !ok(m.currency)) return null
  return { ...m, fee: null, state: null }
}

export function saveColumns(header: string[], map: ColumnMap) {
  try {
    const all = read(), sig = signature(header)
    delete all[sig]
    const next = { [sig]: { date: map.date, description: map.description, amount: map.amount, debit: map.debit, credit: map.credit, currency: map.currency }, ...all }
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(next).slice(0, MAX))))
  } catch { /* memoria del telefono piena o non disponibile: la scelta vale solo per questa volta */ }
}
