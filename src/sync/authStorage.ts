import type { ScopeLease } from '../store/scope'

/** Anche i client auth usano lo stesso lock per il commit della sessione fra schede. */
export function authStorage(key: string, lease?: ScopeLease, allowNewUser = false) {
  let expected = lease ? localStorage.getItem(key) : null
  const check = () => {
    if (!lease) return
    lease.assert()
    if (localStorage.getItem(key) !== expected) throw new DOMException('auth session changed', 'AbortError')
  }
  if (lease) {
    const owner = expected ? JSON.parse(expected)?.user?.id : null
    if ((lease.scope.kind === 'account' ? lease.scope.owner : null) !== owner) throw new DOMException('auth owner mismatch', 'AbortError')
  }
  const commit = async (change: () => void) => {
    if (!navigator.locks) throw Error('Web Locks required for safe authentication storage')
    await navigator.locks.request('quadriamo.auth/' + key, () => { check(); change() })
  }
  return {
    getItem: (name: string) => { check(); return localStorage.getItem(name) },
    setItem: (name: string, value: string) => commit(() => {
      if (lease && name === key && !allowNewUser && JSON.parse(value)?.user?.id !== lease.scope.owner) throw new DOMException('auth owner mismatch', 'AbortError')
      localStorage.setItem(name, value)
      if (name === key) expected = value
    }),
    removeItem: (name: string) => commit(() => {
      localStorage.removeItem(name)
      if (name === key) expected = null
    }),
  }
}
export const authStorageKey = (url: string) => 'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token'
