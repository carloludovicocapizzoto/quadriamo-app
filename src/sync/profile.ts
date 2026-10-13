// Profilo dell'utente registrato (tabella profiles: ognuno legge e scrive solo il proprio).
import { supabase } from './client'

/** Nome e cognome dell'account (tabella profiles). Le risposte sensibili stanno nei dati dell'utente (PrivateProfile). */
export interface Names { first_name: string | null; last_name: string | null }

export const GOALS = ['understand', 'save', 'goal', 'debt', 'invest', 'family'] as const
// marchi: restano uguali in tutte le lingue
export const CARDS = ['bank', 'credit', 'prepaid', 'Revolut', 'N26', 'Hype', 'Satispay', 'PayPal', 'American Express', 'cash', 'other'] as const
export const WHERE = ['bank', 'broker', 'etf', 'stocks', 'bonds', 'pension', 'crypto', 'realestate', 'other'] as const

const flag = (key: string) => ({
  set: () => { try { localStorage.setItem(key, '1') } catch { /* niente */ } },
  get: () => { try { return localStorage.getItem(key) === '1' } catch { return false } },
  clear: () => { try { localStorage.removeItem(key) } catch { /* niente */ } },
})
/** Dopo la registrazione si propone il profilo una volta (anche se la conferma email arriva dopo). */
export const profilePrompt = flag('q.profilePrompt')
/** Configurazione iniziale a passaggi da completare (nuovo account o "continua senza account"). */
export const setupPending = flag('q.setupPending')

export async function loadNames(): Promise<Names> {
  const { data, error } = await supabase!.from('profiles').select('first_name, last_name').maybeSingle()
  if (error) throw error
  return { first_name: data?.first_name ?? null, last_name: data?.last_name ?? null }
}

export async function saveNames(userId: string, n: Names) {
  const { error } = await supabase!.from('profiles').upsert({ user_id: userId, ...n, updated_at: new Date().toISOString() })
  if (error) throw error
}

/** Hai già visto (o saltato) il tutorial per aggiungere l'app alla Home. */
export const installSkip = flag('q.installSkip')
