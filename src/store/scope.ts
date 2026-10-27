export interface DataScope {
  environment: string
  backend: string
  kind: 'account' | 'local' | 'demo' | 'guest' | 'recovery'
  owner: string | null
}

export const scopeKey = (s: DataScope) => JSON.stringify([s.environment, s.backend, s.kind, s.owner])
export const dataKey = (s: DataScope) => 'quadriamo.data.v2/' + encodeURIComponent(scopeKey(s))
export const personalKey = (name: string, s = currentScope().scope) => 'q.v2/' + encodeURIComponent(scopeKey(s)) + '/' + name

export interface ScopeLease {
  scope: DataScope
  id: string
  signal: AbortSignal
  current: () => boolean
  assert: () => void
}
const listeners = new Set<() => void>()
let active: ScopeLease | null = null
let controller: AbortController | null = null

export function activateScope(scope: DataScope): ScopeLease {
  controller?.abort()
  const next = new AbortController()
  controller = next
  const lease: ScopeLease = {
    scope, id: crypto.randomUUID(), signal: next.signal,
    current: () => active === lease && !next.signal.aborted,
    assert: () => { if (!lease.current()) throw new DOMException('session changed', 'AbortError') },
  }
  active = lease
  listeners.forEach(f => { try { f() } catch { /* una cache accessoria guasta non deve impedire il cambio identità */ } })
  return lease
}
export const currentScope = () => {
  if (!active) return activateScope({ environment: 'locked', backend: 'none', kind: 'guest', owner: null })
  return active
}
export const onScopeChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
