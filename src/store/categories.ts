// Eliminare una categoria senza perdere niente: prima si conta chi la usa (movimenti, scadenze, regole, movimenti
// importati da confermare), poi tutto passa a un'altra categoria dello stesso tipo e solo allora la categoria sparisce.
// Nessun elemento viene cancellato; nessun riferimento resta a una categoria che non esiste più.
import { seedRules } from '../engine'
import type { AppData } from './types'

export interface CategoryUsage { transactions: number; events: number; rules: number; inbox: number }

export const usageTotal = (u: CategoryUsage) => u.transactions + u.events + u.rules + u.inbox

/** Chi usa la categoria. Le regole di partenza contano anche se l'utente non le ha mai modificate. */
export function categoryUsage(d: AppData, id: string): CategoryUsage {
  return {
    transactions: d.transactions.filter(t => t.category === id).length,
    events: d.settings.events.filter(e => e.category === id).length,
    rules: (d.settings.rules ?? seedRules()).filter(r => r.category === id).length,
    inbox: (d.inbox ?? []).filter(i => i.category === id).length,
  }
}

/** Le categorie in cui si possono spostare gli elementi: stesso tipo (una spesa resta una spesa), mai quella da eliminare. */
export function moveTargets(d: AppData, id: string) {
  const from = d.settings.categories.find(c => c.id === id)
  return from ? d.settings.categories.filter(c => c.id !== id && c.type === from.type) : []
}

/**
 * Elimina la categoria `id` spostando tutto in `moveTo`. Senza `moveTo` funziona solo se nessuno la usa.
 * Restituisce null (niente cambia) se la richiesta non è valida: categoria inesistente, destinazione di un altro tipo
 * o mancante quando serve. I movimenti spostati ricevono `updatedAt`, così la sincronizzazione li riconosce come modificati.
 */
export function deleteCategory(d: AppData, id: string, moveTo: string | null, at: string): AppData | null {
  if (!d.settings.categories.some(c => c.id === id)) return null
  const used = usageTotal(categoryUsage(d, id)) > 0
  if (used && (!moveTo || !moveTargets(d, id).some(c => c.id === moveTo))) return null
  const categories = d.settings.categories.filter(c => c.id !== id)
  if (!used) return { ...d, settings: { ...d.settings, categories }, settingsUpdatedAt: at }
  const rules = d.settings.rules ?? (seedRules().some(r => r.category === id) ? seedRules() : undefined)
  const settings = {
    ...d.settings,
    categories,
    events: d.settings.events.map(e => e.category === id ? { ...e, category: moveTo } : e),
    ...(rules ? { rules: rules.map(r => r.category === id ? { ...r, category: moveTo! } : r) } : {}),
  }
  return {
    ...d, settings, settingsUpdatedAt: at,
    transactions: d.transactions.map(t => t.category === id ? { ...t, category: moveTo, updatedAt: at } : t),
    ...(d.inbox ? { inbox: d.inbox.map(i => i.category === id ? { ...i, category: moveTo } : i) } : {}),
  }
}
