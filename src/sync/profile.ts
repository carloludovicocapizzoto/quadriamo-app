// Profilo dell'utente registrato (tabella profiles: ognuno legge e scrive solo il proprio).
import { scopedClient } from './scopedClient'
import { currentScope, type ScopeLease } from '../store/scope'
import { local, personal } from '../storage'

/** Nome e cognome dell'account (tabella profiles). Le risposte sensibili stanno nei dati dell'utente (PrivateProfile). */
export interface Names { first_name: string | null; last_name: string | null }

export const GOALS = ['understand', 'save', 'goal', 'debt', 'invest', 'family'] as const
// marchi: restano uguali in tutte le lingue
export const CARDS = ['bank', 'credit', 'prepaid', 'Revolut', 'N26', 'Hype', 'Satispay', 'PayPal', 'American Express', 'cash', 'other'] as const
export const WHERE = ['bank', 'broker', 'etf', 'stocks', 'bonds', 'pension', 'crypto', 'realestate', 'other'] as const

const flag = (key: string, device = false) => ({
  set: () => { (device ? local : personal).set(key, '1') },
  get: () => (device ? local : personal).get(key) === '1',
  clear: () => { (device ? local : personal).set(key, null) },
})
/** Dopo la registrazione si propone il profilo una volta (anche se la conferma email arriva dopo). */
export const profilePrompt = flag('q.profilePrompt')
/** Configurazione iniziale a passaggi da completare (nuovo account o "continua senza account"). */
export const setupPending = flag('q.setupPending')

export async function loadNames(): Promise<Names> {
  const lease = currentScope()
  const { data, error } = await scopedClient(lease)!.from('profiles').select('first_name, last_name').maybeSingle()
  lease.assert()
  if (error) throw error
  return { first_name: data?.first_name ?? null, last_name: data?.last_name ?? null }
}

export async function saveNames(userId: string, n: Names, lease: ScopeLease = currentScope()) {
  if (lease.scope.owner !== userId) throw Error('profile owner mismatch')
  const { error } = await scopedClient(lease)!.from('profiles').upsert({ user_id: userId, ...n, updated_at: new Date().toISOString() })
  lease.assert()
  if (error) throw error
}

/** Hai già visto (o saltato) il tutorial per aggiungere l'app alla Home. */
export const installSkip = flag('q.installSkip', true)
