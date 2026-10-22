import type { AccountStore } from '../store/accountStore'
import type { ScopeLease } from '../store/scope'
import type { PendingWrite, RemoteDocument, CloudStatus } from './protocol'
import { clone, createOperationId, equal, reconcile } from './protocol'
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
  lease.assert()
  const savedCooldown = storage.getSnapshot().cloud?.cooldownUntil
  if (savedCooldown && Date.parse(savedCooldown) > Date.now()) return 'pending'
  if (savedCooldown) await storage.updateCloud(lease, ({ data, cloud }) => {
    delete cloud.cooldownUntil
    return { data, cloud }
  })
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
          cloud.pending = { id: createOperationId(), expected: remote.revision, document: clone(result.document), localAtStart: clone(data) }
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
          delete cloud.cooldownUntil
          cloud.recovery.push({ id: operation.id, at: new Date().toISOString(), reason: 'retry', local: clone(operation.document), remote: null, base: clone(cloud.base?.document ?? null) })
          cloud.status = 'pending'; return { data, cloud }
        }
        delete cloud.cooldownUntil
        const base: RemoteDocument = { protocol: 2, mode: 'protected', revision: receipt.revision, document: clone(operation.document) }
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
      const error = e as { code?: string; message?: string; retryAfterSeconds?: number }
      if (error.code === 'PT429' || /QSYNC_RATE_LIMITED/.test(error.message ?? '')) {
        const seconds = Math.max(1, Math.min(86_400, error.retryAfterSeconds ?? 60))
        await storage.updateCloud(lease, ({ data, cloud }) => {
          cloud.cooldownUntil = new Date(Date.now() + seconds * 1000).toISOString()
          cloud.status = 'pending'
          return { data, cloud }
        })
        return 'pending'
      }
      if (error.code === 'QSYNC_RECEIPT_EXPIRED' || error.code === 'PT409' && /QSYNC_RECEIPT_EXPIRED/.test(error.message ?? '')) {
        const operation = storage.getSnapshot().cloud?.pending
        if (!operation) throw e
        const remote = await read(); lease.assert()
        await storage.updateCloud(lease, ({ data, cloud }) => {
          if (cloud.pending?.id !== operation.id) throw Error('outbox changed during expired receipt recovery')
          if (remote.mode !== 'protected') {
            cloud.status = remote.mode === 'paused' ? 'paused' : 'upgrade'
            return { data, cloud }
          }
          const base = cloud.base ? clone(cloud.base) : null
          cloud.recovery.push({ id: operation.id, at: new Date().toISOString(), reason: 'expired-receipt',
            local: clone(operation.document), remote: clone(remote.document), base: clone(base?.document ?? null) })
          if (!equal(data, operation.document)) cloud.recovery.push({ id: crypto.randomUUID(), at: new Date().toISOString(), reason: 'expired-receipt',
            local: clone(data), remote: clone(remote.document), base: clone(operation.localAtStart) })
          // Reconcile the immutable candidate first, then edits made since it was created.
          // Using the current draft only as localAtStart would discard those newer edits on ACK.
          const candidate = reconcile(base?.document ?? null, operation.document, remote.document)
          const merged = candidate.paths.length ? candidate : reconcile(operation.localAtStart, data, candidate.document)
          const rolledBack = BigInt(remote.revision) < BigInt(operation.expected)
            || base && remote.revision === base.revision && !equal(remote.document, base.document)
          cloud.pending = null; delete cloud.cooldownUntil
          if (rolledBack || merged.paths.length || merged.document === null && (data !== null || operation.document !== null || remote.document !== null)) {
            // An uncertain expired operation requires a whole-document choice. Both the pending
            // candidate and the newer local draft remain exportable in the recovery archive.
            cloud.conflict = { id: operation.id, paths: ['/document'], base,
              local: clone(data), remote: clone(remote), cause: 'expired-receipt' }
            cloud.status = 'conflict'
          } else {
            cloud.base = clone(remote)
            cloud.conflict = null
            if (equal(merged.document, remote.document)) {
              cloud.status = 'reconciled'
              return { data: clone(merged.document), cloud }
            }
            else {
              cloud.pending = { id: createOperationId(), expected: remote.revision, document: clone(merged.document!), localAtStart: clone(data) }
              cloud.status = 'pending'
            }
          }
          return { data, cloud }
        })
        return storage.getSnapshot().cloud?.status ?? 'pending'
      }
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
