// "Chi sei?" al primo avvio: lo studente fuori sede parte con regola, categorie ed entrate pensate per lui.
import { DEFAULT_BUCKETS } from './defaults'
import type { Category, Settings } from './types'

export type Persona = 'student' | 'worker' | 'other'

/**
 * Regola dello studente: niente investimenti obbligati. L'affitto esce prima della divisione (categoria "Affitto"),
 * quindi gli Essenziali coprono spesa, trasporti e università, e resta più spazio per vivere e per il fondo.
 */
export const STUDENT_SHARES: Record<string, number> = { essentials: 0.45, qualityOfLife: 0.35, safetyFund: 0.2, investments: 0 }
/** La regola dello studente di prima, quando l'affitto stava negli Essenziali (per aggiornare chi non l'ha cambiata). */
export const OLD_STUDENT_SHARES: Record<string, number> = { essentials: 0.6, qualityOfLife: 0.25, safetyFund: 0.15, investments: 0 }

const STUDENT_CATEGORIES: Omit<Category, 'name'>[] = [
  { id: 'allowance', type: 'income', defaultBucket: null },
  { id: 'partTime', type: 'income', defaultBucket: null },
  { id: 'university', type: 'expense', defaultBucket: 'essentials' },
]

/** Prima entrata proposta: assegno per lo studente, stipendio per gli altri. */
export const mainIncome = (s: Settings) => s.persona === 'student' && s.categories.some(c => c.id === 'allowance') ? 'allowance' : 'salary'

export function applyPersona(s: Settings, p: Persona): Settings {
  if (p === 'student') {
    const have = new Set(s.categories.map(c => c.id))
    const extra = STUDENT_CATEGORIES.filter(c => !have.has(c.id)).map(c => ({ ...c, name: c.id }))
    // le nuove entrate in cima alle entrate, "Università" subito dopo le spese fisse
    const cats = [...extra.filter(c => c.type === 'income'), ...s.categories]
    const at = cats.findIndex(c => c.id === 'fixedCosts')
    const uni = extra.filter(c => c.type === 'expense')
    cats.splice(at >= 0 ? at + 1 : cats.length, 0, ...uni)
    return { ...s, persona: p, categories: cats, buckets: s.buckets.map(b => ({ ...b, share: STUDENT_SHARES[b.id] ?? b.share })) }
  }
  const shares = Object.fromEntries(DEFAULT_BUCKETS.map(b => [b.id, b.share]))
  return { ...s, persona: p, buckets: s.buckets.map(b => ({ ...b, share: shares[b.id] ?? b.share })) }
}
