// Capitale iniziale: la liquidità che c'era già quando hai iniziato a usare Quadriamo.
// È separato da tutto il resto (entrate del mese, quattro parti, investimenti, obiettivi): non entra nel numero del giorno.
// Si divide in destinazioni, ognuna con una regola d'uso. Ogni aggiornamento del saldo lascia un punto nella storia.

export type CapitalKind = 'emergency' | 'liquid' | 'grow' | 'spendable' | 'locked' | 'goal' | 'other'
export type CapitalPolicy = 'never' | 'emergency' | 'big' | 'always' | 'custom'
export const CAPITAL_KINDS: CapitalKind[] = ['emergency', 'liquid', 'grow', 'spendable', 'locked', 'goal', 'other']
export const CAPITAL_POLICIES: CapitalPolicy[] = ['never', 'emergency', 'big', 'always', 'custom']
export const BIG_PURCHASES = ['car', 'home', 'health', 'tech', 'education', 'travel', 'other'] as const

export interface CapitalPart {
  id: string
  name: string
  kind: CapitalKind
  amount: number
  policy: CapitalPolicy
  bigPurchases?: string[]          // con la regola "solo grandi acquisti": per cosa si può usare
  goalId?: string | null           // destinazione "obiettivo": collegata a un obiettivo che esiste già
  rule?: string                    // regola personalizzata, a parole
}
export interface Capital {
  date: string                     // data di riferimento del saldo (YYYY-MM-DD)
  parts: CapitalPart[]
  history: { date: string; total: number }[]   // un punto per ogni aggiornamento (al massimo uno al giorno)
}

/** La regola di partenza per ogni tipo di destinazione (si può cambiare). */
export const defaultPolicy = (k: CapitalKind): CapitalPolicy =>
  k === 'emergency' ? 'emergency' : k === 'spendable' || k === 'liquid' ? 'always' : k === 'goal' ? 'big' : 'never'

const capitalTotal = (c: Capital) => c.parts.reduce((a, p) => a + Math.max(0, p.amount), 0)

export interface CapitalSummary {
  total: number
  usable: number          // sempre disponibile
  protected: number       // tutto il resto: mai, solo emergenze, solo grandi acquisti, regole proprie
  start: number           // il primo saldo registrato
  preserved: number | null   // quanto del capitale di partenza c'è ancora (1 = tutto), se c'è una storia
}
export function capitalSummary(c: Capital): CapitalSummary {
  const total = capitalTotal(c)
  const usable = c.parts.filter(p => p.policy === 'always').reduce((a, p) => a + Math.max(0, p.amount), 0)
  const start = c.history[0]?.total ?? total
  return { total, usable, protected: total - usable, start, preserved: start > 0 ? total / start : null }
}

/** Nuovo saldo: le destinazioni cambiate e un punto nella storia (lo stesso giorno sostituisce il precedente). */
export function updateCapital(c: Capital, parts: CapitalPart[], today: string): Capital {
  const total = parts.reduce((a, p) => a + Math.max(0, p.amount), 0)
  const history = [...c.history.filter(h => h.date !== today), { date: today, total }].sort((a, b) => a.date.localeCompare(b.date))
  return { date: today, parts, history }
}

/** Si può usare questa parte per una spesa? (per i consigli: es. un'auto dalla parte "grandi acquisti: auto") */
export function canUse(p: CapitalPart, purpose: 'everyday' | 'emergency' | string): boolean {
  if (p.policy === 'always') return true
  if (p.policy === 'emergency') return purpose === 'emergency'
  if (p.policy === 'big') return (p.bigPurchases ?? []).includes(purpose)
  return false
}

// ---------- consigli dal capitale (regole, nessuna intelligenza artificiale) ----------
/** Categoria di spesa → grande acquisto: una spesa in queste categorie può venire da una parte "solo grandi acquisti". */
const PURPOSE_OF: Record<string, string> = { transport: 'car', health: 'health', rent: 'home', university: 'education', travel: 'travel', tech: 'tech' }

export type CapitalAdvice =
  | { id: 'cover'; deficit: number; part: string; available: number }      // il mese chiude in rosso, la parte utilizzabile basta
  | { id: 'protectedOnly'; deficit: number; usable: number }              // il mese chiude in rosso, quello che si può usare non basta
  | { id: 'emergencyLow'; months: number }                                // il fondo di emergenza copre meno di 3 mesi di spese essenziali
  | { id: 'used'; pct: number }                                           // del capitale di partenza è rimasto meno dell'80%

/**
 * Cosa dire sul capitale, in ordine di importanza. `monthEnd` è come finisce il mese a questo ritmo (negativo = sforamento),
 * `essentialsMonth` quanto costano al mese le spese essenziali (parte Essenziali più quelle tolte prima, come l'affitto).
 */
export function capitalAdvice(c: Capital, monthEnd: number | null, essentialsMonth: number): CapitalAdvice[] {
  const out: CapitalAdvice[] = []
  const sum = capitalSummary(c)
  if (monthEnd != null && monthEnd < 0) {
    const deficit = -monthEnd
    const usable = c.parts.filter(p => p.policy === 'always' && p.amount > 0).sort((a, b) => b.amount - a.amount)
    if (usable[0] && usable[0].amount >= deficit) out.push({ id: 'cover', deficit, part: usable[0].name, available: usable[0].amount })
    else out.push({ id: 'protectedOnly', deficit, usable: sum.usable })
  }
  const emergency = c.parts.filter(p => p.kind === 'emergency').reduce((a, p) => a + Math.max(0, p.amount), 0)
  if (emergency > 0 && essentialsMonth > 0 && emergency / essentialsMonth < 3) out.push({ id: 'emergencyLow', months: Math.round(emergency / essentialsMonth * 10) / 10 })
  if (sum.preserved != null && sum.preserved < 0.8) out.push({ id: 'used', pct: Math.round((1 - sum.preserved) * 100) })
  return out
}

/** Una spesa grande in una categoria abbinata (es. Trasporti → auto): da quale parte del capitale può venire, se c'è. */
export function partForPurchase(c: Capital | null | undefined, categoryId: string | undefined, amount: number): CapitalPart | null {
  const purpose = categoryId ? PURPOSE_OF[categoryId] : undefined
  if (!c || !purpose || amount <= 0) return null
  return c.parts.find(p => p.amount >= amount && canUse(p, purpose) && p.policy === 'big') ?? null
}
