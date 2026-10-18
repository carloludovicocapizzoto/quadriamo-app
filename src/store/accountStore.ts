import { reducer, type Action, type AppData, type State } from './state'
import { loadData, saveData } from './persist'
import { scopeKey, type DataScope, type ScopeLease } from './scope'

export interface AccountSnapshot {
  state: State
  error: 'load' | 'save' | 'conflict' | null
  dirty: boolean
}

/** La coda vive oltre il montaggio React: un logout imposto non perde un salvataggio o un recupero in memoria. */
export class AccountStore {
  private snapshot: AccountSnapshot = { state: { loaded: false, data: null }, error: null, dirty: false }
  private listeners = new Set<() => void>()
  private revision = 0
  private changes = 0
  private saved = 0
  private tail: Promise<void> = Promise.resolve()
  private channel: BroadcastChannel | null = null
  ready: Promise<void>
  readonly scope: DataScope

  constructor(scope: DataScope, seed?: AppData) { this.scope = scope; this.ready = this.load(seed) }
  getSnapshot = () => this.snapshot
  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f) } }
  private emit(patch: Partial<AccountSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach(f => f())
  }
  private async load(seed?: AppData) {
    try {
      const result = await loadData(this.scope)
      if (result.kind !== 'found' && result.kind !== 'empty') { this.emit({ error: 'load' }); return }
      this.revision = result.revision
      this.emit({ state: reducer({ loaded: false, data: null }, { type: 'load', data: result.kind === 'found' ? result.data : null }), error: null })
      if (seed && result.kind === 'empty') this.dispatch({ type: 'replace', data: seed })
    } catch { this.emit({ error: 'load' }) }
  }
  dispatch = (action: Action) => {
    if (!this.snapshot.state.loaded || action.type === 'load' || this.scope.kind === 'guest') return
    const state = reducer(this.snapshot.state, action)
    if (state.data === this.snapshot.state.data) return
    // Il runtime impedisce di promuovere campioni a dati personali, anche quando un import perde il flag demo.
    if (this.scope.kind === 'account' && state.data?.demo) return
    if (this.scope.kind === 'demo' && state.data && !state.data.demo) return
    this.changes++
    this.emit({ state, dirty: true })
    this.enqueue()
  }
  private enqueue() {
    const payload = structuredClone(this.snapshot.state.data)
    const change = this.changes
    this.tail = this.tail.then(async () => {
      if (this.snapshot.error) return
      try {
        this.revision = await saveData(this.scope, payload, this.revision)
        this.saved = change
        this.emit({ dirty: this.saved !== this.changes })
        try { this.channel?.postMessage({ scope: scopeKey(this.scope), revision: this.revision }) } catch { /* il salvataggio è già durevole */ }
      } catch (e) {
        this.emit({ error: e instanceof Error && e.message === 'cache changed in another tab' ? 'conflict' : 'save', dirty: true })
      }
    })
  }
  async flush() {
    await this.ready
    // Le azioni che arrivano durante il salvataggio aggiungono una nuova coda.
    let pending: Promise<void>
    do { pending = this.tail; await pending } while (pending !== this.tail)
    if (this.snapshot.error || this.snapshot.dirty) throw Error('local data not saved')
  }
  async retry() {
    if (!this.snapshot.state.loaded) { this.ready = this.load(); await this.ready; return }
    if (this.snapshot.error === 'conflict') return // non sovrascrivere la copia dell'altra scheda
    this.emit({ error: null })
    this.enqueue()
    await this.flush()
  }
  async refresh() {
    try {
      const before = this.changes
      const result = await loadData(this.scope)
      if (result.kind !== 'found' && result.kind !== 'empty') { this.emit({ error: 'load' }); return }
      if (result.revision <= this.revision) return
      if (this.snapshot.dirty || before !== this.changes) { this.emit({ error: 'conflict' }); return }
      this.revision = result.revision
      this.emit({ state: reducer(this.snapshot.state, { type: 'load', data: result.kind === 'found' ? result.data : null }) })
    } catch { this.emit({ error: 'load' }) }
  }
  watch() {
    if (typeof window === 'undefined') return () => {}
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('quadriamo.cache.v2')
    this.channel = channel
    if (channel) channel.onmessage = e => {
      if (e.data?.scope === scopeKey(this.scope) && e.data.revision > this.revision) void this.refresh()
    }
    const refresh = () => { void this.refresh() }
    window.addEventListener('focus', refresh)
    void this.ready.then(refresh)
    return () => { window.removeEventListener('focus', refresh); channel?.close(); if (this.channel === channel) this.channel = null }
  }
}

const stores = new Map<string, AccountStore>()
export function accountStore(scope: DataScope, seed?: AppData) {
  const key = scopeKey(scope)
  let store = stores.get(key)
  if (!store) { store = new AccountStore(scope, seed); stores.set(key, store) }
  return store
}
export async function flushScope(lease: ScopeLease) {
  lease.assert()
  await stores.get(scopeKey(lease.scope))?.flush()
  lease.assert()
}
