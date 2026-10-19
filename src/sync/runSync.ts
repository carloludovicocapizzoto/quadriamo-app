import type { AccountStore } from '../store/accountStore'
import type { ScopeLease } from '../store/scope'
import type { PendingWrite, RemoteDocument, CloudStatus } from './protocol'
import { clone, equal, reconcile } from './protocol'
import type { WriteReceipt } from './remote'

export interface SyncJob {
  lease: ScopeLease; storage: AccountStore
  read: () => Promise<RemoteDocument>; write: (pending: PendingWrite) => Promise<WriteReceipt>
  sleep?: (ms: number) => Promise<void>
}
const retryable = (e: unknown) => {
  const error = e as { code?: string; status?: number }
  return ['40P01', '40001', '55P03'].includes(error.code ?? '') || !error.status || error.status >= 500 || error.status === 429
}
export async function runSync({ lease, storage, read, write, sleep }: SyncJob): Promise<CloudStatus> {
  if (lease.scope.kind !== 'account') throw Error('account required')
  const wait = sleep ?? (ms => new Promise<void>((ok, bad) => {
    const aborted = () => { clearTimeout(timer); bad(new DOMException('session changed', 'AbortError')) }
    const timer = setTimeout(() => { lease.signal.removeEventListener('abort', aborted); ok() }, ms)
    lease.signal.addEventListener('abort', aborted, { once: true }); if (lease.signal.aborted) aborted()
  }))
  for (let attempt = 0; attempt < 3; attempt++) {
    lease.assert(); await storage.flush(); await storage.refresh(); await storage.flush(); lease.assert()
    if (storage.getSnapshot().cloud?.conflict) return 'conflict'
    try {
      let pending = storage.getSnapshot().cloud?.pending
      if (!pending) {
        const remote = await read(); lease.assert()
        await storage.updateCloud(lease, ({ data, cloud }) => {
          if (cloud.conflict || cloud.pending) return { data, cloud }
          cloud.activationBlocked = remote.mode === 'legacy' && remote.activationAllowed === false
          cloud.available = remote.mode === 'legacy' && !cloud.activationBlocked
          if (cloud.base && (BigInt(remote.revision) < BigInt(cloud.base.revision)
            || remote.revision === cloud.base.revision && !equal(remote.document, cloud.base.document))) {
            cloud.conflict = { id: crypto.randomUUID(), cause: 'revision', paths: ['/document'], base: clone(cloud.base), local: clone(data), remote: clone(remote) }
            cloud.status = 'conflict'; return { data, cloud }
          }
          if (remote.mode !== 'protected') {
            cloud.status = remote.mode === 'paused' ? 'paused' : 'upgrade'
            if (!cloud.base) {
              if (data === null || equal(data, remote.document)) { cloud.base = clone(remote); return { data: clone(remote.document), cloud } }
              cloud.conflict = { id: crypto.randomUUID(), paths: ['/document'], base: null, local: clone(data), remote: clone(remote) }
              cloud.status = 'conflict'
            }
            return { data, cloud }
          }
          const result = !cloud.base && data && !equal(data, remote.document)
            ? { document: null, paths: ['/document'] } : reconcile(cloud.base?.document ?? null, data, remote.document)
          if (result.paths.length || result.document === null && (data !== null || remote.document !== null)) {
            cloud.conflict = { id: crypto.randomUUID(), paths: result.paths.length ? result.paths : ['/document'], base: clone(cloud.base), local: clone(data), remote: clone(remote) }
            cloud.status = 'conflict'; return { data, cloud }
          }
          if (equal(result.document, remote.document)) {
            cloud.base = clone(remote); cloud.status = 'ok'; return { data: clone(remote.document), cloud }
          }
          if (!result.document) throw Error('empty document cannot be uploaded')
          cloud.pending = { id: crypto.randomUUID(), expected: remote.revision, document: clone(result.document), localAtStart: clone(data) }
          cloud.status = 'pending'; return { data, cloud }
        })
        const current = storage.getSnapshot().cloud!
        if (!current.pending) return current.status
        pending = current.pending
      }
      const operation = clone(pending), receipt = await write(operation); lease.assert()
      if (receipt.operation !== operation.id || !/^\d+$/.test(receipt.revision) || !['applied', 'conflict'].includes(receipt.status)
        || receipt.status === 'applied' && BigInt(receipt.revision) < BigInt(operation.expected)) throw Error('invalid acknowledgment')
      await storage.updateCloud(lease, ({ data, cloud }) => {
        if (cloud.pending?.id !== operation.id) throw Error('outbox changed')
        cloud.pending = null
        if (receipt.status === 'conflict') {
          cloud.recovery.push({ id: operation.id, at: new Date().toISOString(), reason: 'retry', local: clone(operation.document), remote: null, base: clone(cloud.base?.document ?? null) })
          cloud.status = 'pending'; return { data, cloud }
        }
        const base: RemoteDocument = { protocol: 1, mode: 'protected', revision: receipt.revision, document: clone(operation.document) }
        cloud.base = base; cloud.lastAck = { operation: receipt.operation, revision: receipt.revision }
        const merged = reconcile(operation.localAtStart, data, operation.document)
        if (merged.paths.length) {
          cloud.conflict = { id: crypto.randomUUID(), paths: merged.paths, base: { ...base, document: clone(operation.localAtStart) }, local: clone(data), remote: clone(base) }
          cloud.status = 'conflict'; return { data, cloud }
        }
        cloud.status = equal(merged.document, operation.document) ? 'ok' : 'pending'
        return { data: merged.document, cloud }
      })
      const status = storage.getSnapshot().cloud!.status
      if (status === 'ok' || status === 'conflict') return status
    } catch (e) {
      lease.assert()
      if (storage.getSnapshot().error) throw e
      const error = e as { code?: string; message?: string }
      if (error.code === 'PGRST202' || /UPGRADE|UNSUPPORTED|NOT_ACTIVATED|PAUSED/.test(error.code + ' ' + error.message)) {
        const status = /PAUSED/.test(error.message ?? '') ? 'paused' : 'upgrade'
        await storage.updateCloud(lease, ({ data, cloud }) => ({ data, cloud: { ...cloud, status, available: false } })); return status
      }
      if (!retryable(e)) throw e
      if (attempt === 2) return 'pending'
    }
    if (attempt < 2) await wait(250 * 2 ** attempt + Math.floor(Math.random() * 100))
  }
  return 'pending'
}
