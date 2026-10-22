import type { Session } from '@supabase/supabase-js'
import { readAuthValue } from './authStorage'

/** Identità conservata, non verifica del token sul server. I servizi dati usano ancora SDK e RLS. */
export function storedAuthSession(key: string, namespace: string, backend?: string): Session | null {
  const raw = readAuthValue(key, namespace)
  if (raw === null) return null
  const value = JSON.parse(raw)
  if (!value?.user || typeof value.user.id !== 'string' || !value.user.id
    || typeof value.access_token !== 'string' || typeof value.refresh_token !== 'string' || !value.refresh_token
    || !Number.isFinite(value.expires_at) || value.token_type !== 'bearer') throw Error('invalid stored authentication')
  const parts = value.access_token.split('.')
  if (parts.length !== 3 || parts.some((part: string) => !part)) throw Error('invalid stored token')
  const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  if (claims.sub !== value.user.id || !Number.isFinite(claims.exp)
    || claims.role !== undefined && claims.role !== 'authenticated') throw Error('stored authentication owner mismatch')
  if (backend && claims.iss !== backend.replace(/\/$/, '') + '/auth/v1') throw Error('stored authentication backend mismatch')
  return value as Session
}
export function cachedOfflineSession(key: string, namespace: string, backend?: string, unreachable = false): Session | null {
  if (!unreachable && (typeof navigator === 'undefined' || navigator.onLine !== false)) return null
  try { return storedAuthSession(key, namespace, backend) } catch { return null }
}
