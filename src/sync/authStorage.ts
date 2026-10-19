import type { ScopeLease } from '../store/scope'

interface AuthRecord { format: 1; generation: string; session: string | null }
const listeners = new Map<string, Set<() => void>>()
const cleanupErrors = new Set<string>()
const writeErrors = new Set<string>()
export const authRecordKey = (namespace: string) => 'q.auth.v1/' + encodeURIComponent(namespace)
function snapshot(key: string, namespace: string) {
  const record = localStorage.getItem(authRecordKey(namespace))
  if (record === null) {
    const value = localStorage.getItem(key)
    return { stamp: JSON.stringify([null, value]), value }
  }
  const parsed = JSON.parse(record) as AuthRecord
  if (parsed?.format !== 1 || typeof parsed.generation !== 'string' || !parsed.generation
    || parsed.session !== null && typeof parsed.session !== 'string') throw Error('unsupported authentication record')
  return { stamp: record, value: parsed.session }
}
export const readAuthValue = (key: string, namespace = key) => snapshot(key, namespace).value
export const authVersion = (key: string, namespace = key) => snapshot(key, namespace).stamp
export const authCleanupFailed = (namespace: string) => cleanupErrors.has(namespace)
export const authWriteFailed = (namespace: string) => writeErrors.has(namespace)
const notify = (namespace: string) => listeners.get(namespace)?.forEach(f => { try { f() } catch { /* il commit è già durevole */ } })
export function watchAuthStorage(key: string, namespace: string, changed: () => void) {
  const set = listeners.get(namespace) ?? new Set<() => void>(); listeners.set(namespace, set); set.add(changed)
  const storage = (event: StorageEvent) => { if (event.key === authRecordKey(namespace) || event.key === key || event.key === null) changed() }
  if (typeof window !== 'undefined') window.addEventListener('storage', storage)
  return () => { set.delete(changed); if (!set.size) listeners.delete(namespace); if (typeof window !== 'undefined') window.removeEventListener('storage', storage) }
}
export async function retryAuthCleanup(key: string, namespace: string) {
  writeErrors.delete(namespace)
  if (!cleanupErrors.has(namespace)) return
  const expected = snapshot(key, namespace)
  if (!navigator.locks) throw Error('Web Locks required for safe authentication storage')
  await navigator.locks.request('quadriamo.auth/' + namespace, () => {
    if (snapshot(key, namespace).stamp !== expected.stamp) throw new DOMException('auth session changed', 'AbortError')
    localStorage.removeItem(key); cleanupErrors.delete(namespace); notify(namespace)
  })
}

/** Una sola scrittura atomica conserva credenziale e generazione; anche l'SDK principale usa CAS. */
export function authStorage(key: string, lease?: ScopeLease, allowNewUser = false, namespace = key, ownCommit?: () => void, sdkWrites = false) {
  let expected = snapshot(key, namespace)
  let committed = false
  let failure: unknown
  const auxiliary = (name: string) => name === key + '-user' || name.startsWith(key + '-') && name.endsWith('-code-verifier')
  const check = (cleanup?: string) => {
    if (!(committed && cleanup && auxiliary(cleanup))) lease?.assert()
    if (snapshot(key, namespace).stamp !== expected.stamp) throw new DOMException('auth session changed', 'AbortError')
  }
  if (lease) {
    const owner = expected.value ? JSON.parse(expected.value)?.user?.id : null
    if ((lease.scope.kind === 'account' ? lease.scope.owner : null) !== owner) throw new DOMException('auth owner mismatch', 'AbortError')
  }
  const commit = async (change: () => void, cleanup?: string) => {
    if (!navigator.locks) throw Error('Web Locks required for safe authentication storage')
    await navigator.locks.request('quadriamo.auth/' + namespace, () => {
      try { check(cleanup) } catch (error) {
        // L'SDK di background non ha una lease UI: un client ritirato diventa inerte.
        // I comandi espliciti continuano a ricevere l'errore, senza fingere il successo.
        if (!lease) return
        if (sdkWrites) { failure = error; return }
        throw error
      }
      try { change() } catch (error) {
        if (!sdkWrites) throw error
        failure = error; writeErrors.add(namespace); notify(namespace)
      }
    })
  }
  const primary = (value: string | null) => {
    const record: AuthRecord = { format: 1, generation: crypto.randomUUID(), session: value }
    const serialized = JSON.stringify(record)
    localStorage.setItem(authRecordKey(namespace), serialized)
    expected = { stamp: serialized, value }
    committed = true
    writeErrors.delete(namespace)
    ownCommit?.()
    // Il tombstone resta autorevole anche se il cleanup della chiave precedente fallisce.
    try { localStorage.removeItem(key); cleanupErrors.delete(namespace) }
    catch (error) { cleanupErrors.add(namespace); throw error }
    finally { notify(namespace) }
  }
  return {
    failure: () => failure,
    getItem: (name: string) => {
      try { check(name) } catch (error) { if (!lease) return null; throw error }
      return name === key ? expected.value : localStorage.getItem(name)
    },
    setItem: (name: string, value: string) => commit(() => {
      if (lease && name === key && !allowNewUser && JSON.parse(value)?.user?.id !== lease.scope.owner) throw new DOMException('auth owner mismatch', 'AbortError')
      if (name === key) primary(value); else localStorage.setItem(name, value)
    }),
    removeItem: (name: string) => commit(() => {
      if (name === key) primary(null); else localStorage.removeItem(name)
    }, name),
  }
}
export const authStorageKey = (url: string) => 'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token'
