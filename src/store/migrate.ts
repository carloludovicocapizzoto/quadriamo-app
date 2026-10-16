// Aggiornamento dei dati salvati con versioni precedenti dell'app (settings.schema).
import { FIRST, OLD_STUDENT_SHARES, STUDENT_SHARES, fromRecurring, seedRules, type Recurring, type Settings } from '../engine'
import type { AppData } from './types'

/** Le impostazioni come erano fino allo schema 4: con i "pagamenti ricorrenti" al posto degli eventi del calendario. */
type Legacy = Settings & { recurring?: Recurring[] }

/** Come si chiama l'affitto nelle quattro lingue (pagamenti ricorrenti e regole creati prima della categoria "Affitto"). */
const RENT_NAMES = ['affitto', 'rent', 'alquiler', 'loyer']

/**
 * Aggiorna dati salvati con versioni precedenti dell'app. Ogni passo si applica una volta sola
 * (`settings.schema`): una categoria aggiunta qui e poi cancellata dall'utente non torna.
 */
export function migrate(d: AppData | null): AppData | null {
  if (!d) return d
  let s = d.settings as Legacy
  if (!s.rules) s = { ...s, rules: seedRules() }
  if ((s.schema ?? 0) < 2) {
    // 2: categoria "Rate e finanziamenti", subito dopo i costi fissi
    const categories = [...s.categories]
    if (!categories.some(c => c.id === 'loans')) {
      const bucket = s.buckets.find(b => b.id === 'essentials')?.id ?? s.buckets[0]?.id ?? null
      const at = categories.findIndex(c => c.id === 'fixedCosts')
      categories.splice(at + 1, 0, { id: 'loans', name: 'loans', type: 'expense', defaultBucket: bucket })
    }
    s = { ...s, categories, schema: 2 }
  }
  if ((s.schema ?? 0) < 3) {
    // 3: l'affitto ha una categoria sua, pagata prima di dividere le entrate nelle quattro parti
    const categories = [...s.categories]
    if (!categories.some(c => c.id === 'rent')) {
      const at = Math.max(0, categories.findIndex(c => c.id === 'fixedCosts'))
      categories.splice(at, 0, { id: 'rent', name: 'rent', type: 'expense', defaultBucket: FIRST })
    }
    const isRent = (name: string) => RENT_NAMES.includes(name.trim().toLowerCase())
    const recurring = (s.recurring ?? []).map(r => r.category === 'fixedCosts' && isRent(r.name) ? { ...r, category: 'rent' } : r)
    const rules = s.rules?.map(r => r.category === 'fixedCosts' && isRent(r.keyword) ? { ...r, category: 'rent' } : r)
    // lo studente con la regola di partenza: con l'affitto fuori, gli Essenziali non hanno più bisogno del 60%
    const oldRule = s.persona === 'student' && s.buckets.every(b => Math.abs(b.share - (OLD_STUDENT_SHARES[b.id] ?? -1)) < 1e-9)
    const buckets = oldRule ? s.buckets.map(b => ({ ...b, share: STUDENT_SHARES[b.id] ?? b.share })) : s.buckets
    s = { ...s, categories, recurring, rules, buckets, schema: 3 }
  }
  if ((s.schema ?? 0) < 4) {
    // 4: Viaggi e Tecnologia, subito dopo Svago e shopping (servono anche al capitale: "solo grandi acquisti")
    const categories = [...s.categories]
    const bucket = s.buckets.find(b => b.id === 'qualityOfLife')?.id ?? s.buckets[0]?.id ?? null
    let at = categories.findIndex(c => c.id === 'funShopping')
    for (const id of ['travel', 'tech']) {
      if (categories.some(c => c.id === id)) continue
      at = at < 0 ? categories.length : at + 1
      categories.splice(at, 0, { id, name: id, type: 'expense', defaultBucket: bucket })
    }
    s = { ...s, categories, schema: 4 }
  }
  if ((s.schema ?? 0) < 5) {
    // 5: i pagamenti ricorrenti diventano eventi mensili del calendario (stessi conti). Identificativi fissi:
    // due dispositivi che aggiornano gli stessi dati ottengono gli stessi eventi, senza doppioni
    const { recurring = [], ...rest } = s
    s = { ...rest, events: [...(s.events ?? []), ...recurring.map((r, i) => fromRecurring(r, s, `rec${i + 1}`))], schema: 5 }
  }
  return s === d.settings ? d : { ...d, settings: s }
}
