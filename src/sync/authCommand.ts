import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '../env'
import type { ScopeLease } from '../store/scope'
import { authStorage, authStorageKey } from './authStorage'

/** Chiude soltanto la sessione del dispositivo, senza rinnovo o revoca remota implicita. */
export async function closeLocalSession(lease: ScopeLease) {
  lease.assert()
  if (!ENV.supabase) throw Error('auth unavailable')
  const key = authStorageKey(ENV.supabase.url)
  await authStorage(key, lease, false, JSON.stringify([ENV.name, ENV.supabase.url.replace(/\/$/, '')])).removeItem(key)
}

/** Un comando non può acquisire il token successivo né riscrivere una sessione cambiata durante la risposta. */
export async function authCommand<T>(lease: ScopeLease, run: (auth: SupabaseClient['auth']) => Promise<T>, allowNewUser = false): Promise<T> {
  lease.assert()
  if (!ENV.supabase) throw Error('auth unavailable')
  const key = authStorageKey(ENV.supabase.url)
  const storage = authStorage(key, lease, allowNewUser, JSON.stringify([ENV.name, ENV.supabase.url.replace(/\/$/, '')]), undefined, true)
  const client = createClient(ENV.supabase.url, ENV.supabase.key, {
    auth: { storageKey: key, storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, skipAutoInitialize: true },
    global: { fetch: async (url, init) => {
      if (storage.failure()) throw storage.failure()
      storage.getItem(key)
      const response = await fetch(url, { ...init, signal: lease.signal })
      if (storage.failure()) throw storage.failure()
      storage.getItem(key)
      return response
    } },
  })
  try {
    const result = await run(client.auth)
    if (storage.failure()) throw storage.failure()
    return result
  } finally { await client.auth.dispose() }
}
