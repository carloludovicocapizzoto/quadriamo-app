// Proposte per il calendario: spese ed entrate che sembrano tornare ogni mese (affitto, bollette, abbonamenti, stipendio,
// versamenti nel PAC). Solo regole, nessuna AI: stessa descrizione e categoria in almeno 3 mesi diversi degli ultimi 6,
// a circa un mese di distanza e una volta sola al mese, con importi simili, l'ultima da non più di 45 giorni, e non già nel calendario.
// Niente si aggiunge da solo: l'utente vede la proposta, la conferma (eventualmente cambiandola) o la scarta.
import { nth, type CalEvent, type EventKind } from './calendar'
import { addDays, daysBetween } from './dates'
import { keywordFor } from './rules'
import type { Category, Transaction } from './types'

export interface Suggestion {
  key: string                // descrizione normalizzata + categoria: serve a scartarla per sempre
  kind: EventKind
  title: string
  amount: number
  category: string
  date: string               // la prossima volta prevista (da oggi in poi)
  count: number              // in quanti mesi è comparsa
}

const LOOKBACK = 190, MIN_MONTHS = 3, MAX_AGE = 45, TOLERANCE = 0.2, EXACT = 0.02
/** Categorie di spese fisse: lì l'importo può cambiare un po' (bollette). Altrove (svago, cibo…) conta solo se è sempre uguale (un abbonamento). */
const FIXED = new Set(['rent', 'fixedCosts', 'loans', 'transport', 'health'])
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

function kindFor(c: Category): EventKind {
  if (c.type === 'income') return c.id === 'salary' ? 'salary' : 'income'
  if (c.id === 'investmentsSaving') return 'pac'
  if (c.type === 'saving') return 'saving'
  return c.id === 'rent' ? 'rent' : c.id === 'loans' ? 'loan' : c.id === 'fixedCosts' ? 'bill' : 'payment'
}

/** Già nel calendario: stesso nome, oppure un evento che si ripete con la stessa categoria e un importo simile. */
function covered(events: CalEvent[], key: string, category: string, amount: number): boolean {
  return events.some(e => keywordFor(e.title) === key ||
    (!!e.repeat && e.category === category && e.amount != null && Math.abs(e.amount - amount) <= amount * TOLERANCE))
}

/** Al massimo `max` proposte, prima quelle viste più volte. `dismissed`: le chiavi scartate. */
export function suggestEvents(txs: Transaction[], categories: Category[], events: CalEvent[], today: string,
  dismissed: string[] = [], max = 3): Suggestion[] {
  const from = addDays(today, -LOOKBACK)
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (!t.date || t.date < from || t.date > today || !t.category || !(t.amount && t.amount > 0) || t.currency) continue
    const word = keywordFor(t.description)
    if (!word) continue
    const key = `${word}|${t.category}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const out: Suggestion[] = []
  for (const [key, list] of groups) {
    if (dismissed.includes(key)) continue
    const cat = categories.find(c => c.id === list[0].category)
    if (!cat) continue
    // una volta per mese (l'ultima): due spese nello stesso mese non fanno una ricorrenza
    const byMonth = new Map<string, Transaction>()
    for (const t of [...list].sort((a, b) => a.date!.localeCompare(b.date!))) byMonth.set(t.date!.slice(0, 7), t)
    const months = [...byMonth.values()]
    // una scadenza vera compare una volta al mese: il supermercato due volte al mese non è un pagamento ricorrente
    if (months.length < MIN_MONTHS || list.length > months.length * 1.25) continue
    const last = months[months.length - 1]
    if (daysBetween(last.date!, today) > MAX_AGE) continue
    const gaps = months.slice(1).map((t, i) => daysBetween(months[i].date!, t.date!))
    const gap = median(gaps)
    if (gap < 25 || gap > 36) continue
    const amounts = months.map(t => t.amount!)
    const typical = median(amounts)
    const tol = cat.type === 'expense' && !FIXED.has(cat.id) ? EXACT : TOLERANCE
    if (amounts.filter(a => Math.abs(a - typical) <= typical * tol).length < Math.ceil(months.length * 0.75)) continue
    const amount = Math.round(last.amount! * 100) / 100
    const word = key.split('|')[0]
    if (covered(events, word, cat.id, amount)) continue
    // la prossima volta: lo stesso giorno del mese, da oggi in poi
    let n = 1, date = nth({ date: last.date!, repeat: { every: 1, unit: 'month' } }, n)
    while (date < today && n < 12) date = nth({ date: last.date!, repeat: { every: 1, unit: 'month' } }, ++n)
    out.push({ key, kind: kindFor(cat), title: last.description.trim().slice(0, 60), amount, category: cat.id, date, count: months.length })
  }
  return out.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date)).slice(0, max)
}
