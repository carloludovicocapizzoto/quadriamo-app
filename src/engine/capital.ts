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

export const capitalTotal = (c: Capital) => c.parts.reduce((a, p) => a + Math.max(0, p.amount), 0)

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
