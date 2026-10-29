// Client Supabase: attivo solo se l'ambiente ha URL e chiave pubblica (src/env.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { authStorage, authStorageKey, authVersion, watchAuthStorage, authCleanupFailed, authWriteFailed, retryAuthCleanup } from './authStorage'
import { ENV } from '../env'
import { storedAuthSession } from './offlineSession'
import { INVITE_LINK } from '../entry'
import { alphaFetch } from './alphaFetch'

// La nuova Alpha manda solo la Data API alla funzione della propria origine (alphaFetch).
export { alphaFetch }

export const AUTH_KEY = ENV.supabase ? authStorageKey(ENV.supabase.url) : ''
export const ALPHA_INVITE_LINK = ENV.name === 'alpha' && INVITE_LINK
export const AUTH_NAMESPACE = ENV.supabase ? JSON.stringify([ENV.name, ENV.supabase.url.replace(/\/$/, '')]) : ''
// The SDK can reject renewal and remove persistence before React mounts. Retain only
// the fact that a session existed, so an involuntary sign-out still has an explanation.
export const AUTH_SESSION_AT_BOOT = (() => {
  try { return !!(ENV.supabase && storedAuthSession(AUTH_KEY, AUTH_NAMESPACE, ENV.supabase.url)) }
  catch { return false } // malformed persistence follows the existing fail-closed runtime path
})()
export let supabase: SupabaseClient | null = null
export let authRuntimeError = false
let version = '', scheduled = false
export const authRuntimeCurrent = () => {
  try { return !ENV.supabase || !authRuntimeError && !authWriteFailed(AUTH_NAMESPACE) && !authCleanupFailed(AUTH_NAMESPACE) && version === authVersion(AUTH_KEY, AUTH_NAMESPACE) } catch { return false }
}
export function isCurrentAuthSession(candidate: Session | null) {
  try {
    if (authWriteFailed(AUTH_NAMESPACE) || authCleanupFailed(AUTH_NAMESPACE)) return false
    const live = storedAuthSession(AUTH_KEY, AUTH_NAMESPACE, ENV.supabase?.url)
    return candidate === null ? live === null : candidate.user.id === live?.user.id && candidate.access_token === live.access_token
      && candidate.refresh_token === live.refresh_token
  } catch { return false }
}
const listeners = new Set<() => void>()
export const watchAuthRuntime = (changed: () => void) => { listeners.add(changed); return () => { listeners.delete(changed) } }
export async function getAuthClient() {
  if (!authRuntimeCurrent()) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (!authRuntimeCurrent()) refreshAuthRuntime()
  }
  return supabase
}
export function refreshAuthRuntime() {
  if (!ENV.supabase) return
  const previous = supabase
  try {
    if (authCleanupFailed(AUTH_NAMESPACE) || authWriteFailed(AUTH_NAMESPACE)) throw Error('authentication persistence incomplete')
    const current = authVersion(AUTH_KEY, AUTH_NAMESPACE)
    storedAuthSession(AUTH_KEY, AUTH_NAMESPACE, ENV.supabase.url)
    if (current === version && supabase && !authRuntimeError) return
    version = current
    const client = createClient(ENV.supabase.url, ENV.supabase.key, { global: { fetch: alphaFetch }, auth: {
      storageKey: AUTH_KEY, storage: authStorage(AUTH_KEY, undefined, false, AUTH_NAMESPACE, () => {
        if (supabase === client) version = authVersion(AUTH_KEY, AUTH_NAMESPACE)
      }, true),
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
    } })
    supabase = client
    authRuntimeError = false
  } catch { supabase = null; authRuntimeError = true }
  listeners.forEach(f => f())
  // Lascia completare la notifica SDK e la pulizia del callback URL prima di ritirare il vecchio client.
  if (previous && previous !== supabase) void previous.auth.dispose().catch(() => undefined)
}
export async function retryAuthRuntime() {
  try { await retryAuthCleanup(AUTH_KEY, AUTH_NAMESPACE) } finally { refreshAuthRuntime() }
}
if (ENV.supabase) {
  refreshAuthRuntime()
  watchAuthStorage(AUTH_KEY, AUTH_NAMESPACE, () => {
    // La notifica sincrona revoca subito gli scope con identità diversa.
    listeners.forEach(f => f())
    if (!scheduled) { scheduled = true; setTimeout(() => { scheduled = false; refreshAuthRuntime() }, 0) }
  })
}
