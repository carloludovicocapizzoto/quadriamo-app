import { reducer, type Action, type AppData, type State } from './state'
import { loadData, saveData } from './persist'
import { scopeKey, type DataScope, type ScopeLease } from './scope'
import { clone, emptyCloud, equal, reconcile, type CloudState } from '../sync/protocol'

export interface AccountSnapshot {
  state: State
  error: 'load' | 'save' | 'conflict' | null
  dirty: boolean
  cloud?: CloudState
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
      this.emit({ state: reducer({ loaded: false, data: null }, { type: 'load', data: result.kind === 'found' ? result.data : null }),
        cloud: this.scope.kind === 'account' ? result.cloud ?? emptyCloud() : undefined, error: null })
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
    const cloud = this.snapshot.cloud ? clone(this.snapshot.cloud) : undefined
    if (cloud) {
      cloud.status = cloud.conflict ? 'conflict' : 'pending'
      if (cloud.conflict) {
        cloud.conflict.local = clone(state.data); cloud.conflict.id = crypto.randomUUID()
        cloud.conflict.paths = cloud.conflict.base ? reconcile(cloud.conflict.base.document, state.data, cloud.conflict.remote.document).paths : ['/document']
        if (!cloud.conflict.paths.length) cloud.conflict.paths = ['/document']
      }
    }
    this.emit({ state, cloud, dirty: true })
    this.enqueue()
  }
  private enqueue() {
    const payload = structuredClone(this.snapshot.state.data)
    const cloud = this.snapshot.cloud ? clone(this.snapshot.cloud) : undefined
    const change = this.changes
    this.tail = this.tail.then(async () => {
      if (this.snapshot.error) return
      try {
        this.revision = await saveData(this.scope, payload, this.revision, cloud)
        this.saved = change
        this.emit({ dirty: this.saved !== this.changes })
        try { this.channel?.postMessage({ scope: scopeKey(this.scope), revision: this.revision }) } catch { /* il salvataggio è già durevole */ }
      } catch (e) {
        const conflict = e instanceof Error && e.message === 'cache changed in another tab'
        // Se lo storage funziona, conserva il draft perdente NELLO STESSO envelope vincente.
        // Non sostituisce né il documento né l'outbox dell'altra scheda.
        if (conflict && this.scope.kind === 'account') {
          try {
            const latest = await loadData(this.scope)
            if (latest.kind === 'found' || latest.kind === 'empty') {
              const target = latest.kind === 'found' ? latest.data : null, metadata = clone(latest.cloud ?? emptyCloud())
              metadata.recovery.push({ id: crypto.randomUUID(), at: new Date().toISOString(), reason: 'local-conflict', local: payload, remote: clone(target), base: cloud?.base?.document ?? null })
              await saveData(this.scope, target, latest.revision, metadata)
              this.channel?.postMessage({ scope: scopeKey(this.scope), revision: latest.revision + 1 })
            }
          } catch { /* il draft rimane in memoria con errore ed esportazione espliciti */ }
        }
        this.emit({ error: conflict ? 'conflict' : 'save', dirty: true })
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
  /** Tutte le transizioni cloud usano la stessa coda e la stessa scrittura atomica delle azioni. */
  async updateCloud(lease: ScopeLease, transform: (current: { data: AppData | null; cloud: CloudState }) => { data: AppData | null; cloud: CloudState }) {
    lease.assert(); await this.flush(); lease.assert()
    if (this.scope.kind !== 'account' || scopeKey(this.scope) !== scopeKey(lease.scope)) throw Error('invalid cloud scope')
    const next = transform({ data: clone(this.snapshot.state.data), cloud: clone(this.snapshot.cloud ?? emptyCloud()) })
    const compatible = reducer(this.snapshot.state, { type: 'load', data: next.data }).data
    if (!equal(compatible, next.data)) { next.data = compatible; if (next.cloud.status === 'ok') next.cloud.status = 'pending' }
    if (equal(next.data, this.snapshot.state.data) && equal(next.cloud, this.snapshot.cloud)) return
    this.changes++
    this.emit({ state: equal(next.data, this.snapshot.state.data) ? this.snapshot.state : { loaded: true, data: next.data }, cloud: next.cloud, dirty: true })
    this.enqueue(); await this.flush(); lease.assert()
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
      const state = reducer(this.snapshot.state, { type: 'load', data: result.kind === 'found' ? result.data : null })
      this.revision = result.revision
      this.emit({ state, cloud: this.scope.kind === 'account' ? result.cloud ?? emptyCloud() : undefined, error: null })
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
export const cachedAccountStore = (scope: DataScope) => stores.get(scopeKey(scope))
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
