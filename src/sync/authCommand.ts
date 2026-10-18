import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '../env'
import type { ScopeLease } from '../store/scope'
import { authStorage, authStorageKey } from './authStorage'

/** Un comando non può acquisire il token successivo né riscrivere una sessione cambiata durante la risposta. */
export async function authCommand<T>(lease: ScopeLease, run: (auth: SupabaseClient['auth']) => Promise<T>, allowNewUser = false): Promise<T> {
  lease.assert()
  if (!ENV.supabase) throw Error('auth unavailable')
  const key = authStorageKey(ENV.supabase.url)
  const storage = authStorage(key, lease, allowNewUser)
  const client = createClient(ENV.supabase.url, ENV.supabase.key, {
    auth: { storageKey: key, storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, skipAutoInitialize: true },
    global: { fetch: async (url, init) => {
      storage.getItem(key)
      const response = await fetch(url, { ...init, signal: lease.signal })
      storage.getItem(key)
      return response
    } },
  })
  try { return await run(client.auth) } finally { await client.auth.dispose() }
}
