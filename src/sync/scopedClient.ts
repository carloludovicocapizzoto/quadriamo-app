import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '../env'
import { currentScope, type ScopeLease } from '../store/scope'
import { supabase, getAuthClient, isCurrentAuthSession, alphaFetch } from './client'

const clients = new WeakMap<ScopeLease, SupabaseClient>()

/** I servizi dati non prendono mai implicitamente il token di un account successivo. */
export function scopedClient(lease = currentScope(), allowAnonymous = false): SupabaseClient | null {
  lease.assert()
  if (!ENV.supabase || !supabase || (!allowAnonymous && lease.scope.kind !== 'account')) return null
  const cached = clients.get(lease)
  if (cached) return cached
  const client = createClient(ENV.supabase.url, ENV.supabase.key, {
    accessToken: async () => {
      lease.assert()
      if (lease.scope.kind !== 'account') return null
      const current = await getAuthClient(); lease.assert()
      if (!current) throw new DOMException('authentication unavailable', 'AbortError')
      const { data, error } = await current.auth.getSession()
      lease.assert()
      if (error || data.session?.user.id !== lease.scope.owner || !isCurrentAuthSession(data.session)) throw new DOMException('session owner mismatch', 'AbortError')
      return data.session.access_token
    },
    global: { fetch: (url, init) => {
      lease.assert()
      return alphaFetch(url, { ...init, signal: init?.signal ? AbortSignal.any([lease.signal, init.signal]) : lease.signal })
    } },
  })
  clients.set(lease, client)
  return client
}
