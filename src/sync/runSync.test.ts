import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import { activateScope } from '../store/scope'
import { AccountStore } from '../store/accountStore'
import { loadData } from '../store/persist'
import type { AppData } from '../store/types'
import { clone, equal, resolveConflict, type RemoteDocument } from './protocol'
import { ProtocolError } from './remote'
import { runSync, type SyncJob } from './runSync'
const db = vi.hoisted(() => ({ values: new Map<string, unknown>(), fail: false, crash: false }))
vi.mock('idb-keyval', () => ({
  get: async (key: string) => structuredClone(db.values.get(key)),
  update: async (key: string, fn: (old: unknown) => unknown) => {
    if (db.fail) throw Error('quota')
    db.values.set(key, structuredClone(fn(structuredClone(db.values.get(key)))))
    if (db.crash) throw Error('crash after commit')
  },
}))
const scope = { environment: 'test', backend: 'synthetic', kind: 'account' as const, owner: 'A' }
const make = (...ids: string[]): AppData => ({ version: 1, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }),
  transactions: ids.map(id => ({ id, amount: 10, category: 'groceries', date: '2026-10-18', description: id })) })
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
beforeEach(() => { db.values.clear(); db.fail = false; db.crash = false })
async function fixture(initialize = true) {
  const storage = new AccountStore(scope), lease = activateScope(scope)
  await storage.ready
  let server: RemoteDocument = { protocol: 1, revision: '1', mode: 'protected', document: make() }
  const receipts = new Map<string, { revision: string; document: AppData }>()
  const read = vi.fn(async () => clone(server))
  const write = vi.fn(async (pending: Parameters<SyncJob['write']>[0]) => {
    const previous = receipts.get(pending.id)
    if (previous) { if (!equal(previous.document, pending.document)) throw Error('idempotency mismatch'); return { operation: pending.id, status: 'applied' as const, revision: previous.revision, replay: true } }
    if (pending.expected !== server.revision) return { operation: pending.id, status: 'conflict' as const, revision: server.revision, replay: false }
    server = { ...server, document: clone(pending.document), revision: String(BigInt(server.revision) + 1n) }
    receipts.set(pending.id, { revision: server.revision, document: clone(pending.document) })
    return { operation: pending.id, status: 'applied' as const, revision: server.revision, replay: false }
  })
  const job: SyncJob = { lease, storage, read, write, sleep: async () => {} }
  if (initialize) await runSync(job)
  return { job, storage, read, write, remote: () => server, change: (document: AppData | null) => { server = { ...server, document, revision: String(BigInt(server.revision) + 1n) } } }
}
const add = async (storage: AccountStore, id: string) => { storage.dispatch({ type: 'addTx', tx: make(id).transactions[0] }); await storage.flush() }
describe('durable conditional synchronization in the product', () => {
  it('preserves local edits without offering activation when the server has not admitted this account to the pilot', async () => {
    const f = await fixture(); await add(f.storage, 'not-yet-admitted')
    f.job.read = async () => ({ ...clone(f.remote()), mode: 'legacy', activationAllowed: false })
    expect(await runSync(f.job)).toBe('upgrade')
    expect(f.storage.getSnapshot().cloud?.available).toBe(false)
    expect(f.storage.getSnapshot().state.data?.transactions.some(t => t.id === 'not-yet-admitted')).toBe(true)
    expect(f.write).not.toHaveBeenCalled()
  })
  it('persists the immutable outbox and payload atomically BEFORE upload', async () => {
    const f = await fixture(); await add(f.storage, 'local')
    f.job.write = async p => { expect(await loadData(scope)).toMatchObject({ cloud: { pending: p, status: 'pending' }, data: { transactions: [expect.objectContaining({ id: 'local' })] } }); return f.write(p) }
    expect(await runSync(f.job)).toBe('ok'); expect(f.remote().document?.transactions[0].id).toBe('local')
  })
  it('does not invent a base during migration of an existing different cache', async () => {
    const f = await fixture(false); f.storage.dispatch({ type: 'replace', data: make('older-cache') }); await f.storage.flush()
    expect(await runSync(f.job)).toBe('conflict'); expect(f.write).not.toHaveBeenCalled()
    expect(f.storage.getSnapshot().cloud?.conflict).toMatchObject({ base: null, local: { transactions: [{ id: 'older-cache' }] } })
  })
  it('safely combines disjoint additions after a stale revision response', async () => {
    const f = await fixture(); await add(f.storage, 'local'); let first = true
    f.job.write = async p => { if (first) { first = false; const other = clone(f.remote().document!); other.transactions.push(make('remote').transactions[0]); f.change(other) } return f.write(p) }
    expect(await runSync(f.job)).toBe('ok'); expect(f.remote().document?.transactions.map(t => t.id).sort()).toEqual(['local', 'remote'])
  })
  it.each(['edit', 'delete', 'settings'])('preserves incompatible %s versions instead of timestamp resolution', async kind => {
    const f = await fixture(); await add(f.storage, 'one'); await runSync(f.job)
    const other = clone(f.remote().document!)
    if (kind === 'settings') {
      f.storage.dispatch({ type: 'setSettings', settings: { ...other.settings, currency: 'USD' } }); other.settings.currency = 'GBP'
    } else {
      f.storage.dispatch({ type: 'updateTx', tx: { ...other.transactions[0], amount: 20 }, at: '2100-01-01' })
      if (kind === 'delete') { other.transactions = []; other.deleted = { one: '2200-01-01' } } else other.transactions[0].amount = 30
    }
    await f.storage.flush(); f.change(other)
    expect(await runSync(f.job)).toBe('conflict'); expect(f.storage.getSnapshot().cloud?.conflict?.remote.document).toEqual(other)
  })
  it('lost response retries exactly the same UUID and document without a second revision', async () => {
    const f = await fixture(); await add(f.storage, 'once'); let first = true
    f.job.write = async p => { const r = await f.write(p); if (first) { first = false; throw new TypeError('lost response after commit') } return r }
    expect(await runSync(f.job)).toBe('ok'); expect(f.remote().revision).toBe('2')
    expect(f.write.mock.calls[0][0]).toEqual(f.write.mock.calls[1][0])
  })
  it('transport failures stop after three attempts and survive reopening', async () => {
    const f = await fixture(); await add(f.storage, 'offline'); const fail = vi.fn(async () => { throw new TypeError('network') }); f.job.write = fail
    expect(await runSync(f.job)).toBe('pending'); expect(fail).toHaveBeenCalledTimes(3)
    const id = f.storage.getSnapshot().cloud?.pending?.id, reopened = new AccountStore(scope); await reopened.ready
    expect(reopened.getSnapshot().cloud?.pending?.id).toBe(id)
    expect(await runSync({ ...f.job, storage: reopened, write: f.write })).toBe('ok')
  })
  it('does not acknowledge upload after logout or revive it after A→B→A', async () => {
    const f = await fixture(); await add(f.storage, 'A-only'); const held = deferred<Awaited<ReturnType<SyncJob['write']>>>()
    f.job.write = async p => { const ack = await f.write(p); return held.promise.then(() => ack) }
    const work = runSync(f.job); await vi.waitFor(() => expect(f.write).toHaveBeenCalled())
    activateScope({ ...scope, owner: 'B' }); activateScope(scope); held.resolve({ status: 'applied', operation: '', revision: '0', replay: false })
    await expect(work).rejects.toThrow('session'); expect(f.storage.getSnapshot().cloud?.pending).toBeTruthy()
    expect(await runSync({ ...f.job, lease: activateScope(scope), write: f.write })).toBe('ok')
  })
  it('does not lose edits made during upload', async () => {
    const f = await fixture(); await add(f.storage, 'first'); let once = true
    f.job.write = async p => { if (once) { once = false; await add(f.storage, 'second') } return f.write(p) }
    expect(await runSync(f.job)).toBe('ok'); expect(f.remote().document?.transactions.map(t => t.id).sort()).toEqual(['first', 'second'])
  })
  it('blocks all network writes if saving the outbox fails', async () => {
    const f = await fixture(); await add(f.storage, 'valid'); db.fail = true
    await expect(runSync(f.job)).rejects.toThrow(); expect(f.write).not.toHaveBeenCalled(); expect(f.storage.getSnapshot().error).toBe('save')
  })
  it('a failed local acknowledgment save keeps the durable pending operation recoverable after server commit', async () => {
    const f = await fixture(); await add(f.storage, 'committed'); f.job.write = async p => { const ack = await f.write(p); db.fail = true; return ack }
    await expect(runSync(f.job)).rejects.toThrow(); expect(f.storage.getSnapshot().error).toBe('save')
    const saved = await loadData(scope); expect(saved).toMatchObject({ cloud: { status: 'pending', pending: expect.any(Object) } })
    db.fail = false; const reopened = new AccountStore(scope); await reopened.ready
    expect(await runSync({ ...f.job, storage: reopened, write: f.write })).toBe('ok'); expect(f.remote().revision).toBe('2')
  })
  it('recovers a pending operation after crash just after local atomic commit', async () => {
    const f = await fixture(); await add(f.storage, 'crash'); db.crash = true
    await expect(runSync(f.job)).rejects.toThrow(); expect(f.write).not.toHaveBeenCalled(); db.crash = false
    const reopened = new AccountStore(scope); await reopened.ready
    expect(reopened.getSnapshot().cloud?.pending).toBeTruthy(); expect(await runSync({ ...f.job, storage: reopened })).toBe('ok')
  })
  it('requires activation instead of falling back to the legacy writer', async () => {
    const f = await fixture(false); f.job.read = async () => ({ ...f.remote(), mode: 'legacy' })
    expect(await runSync(f.job)).toBe('upgrade'); expect(f.write).not.toHaveBeenCalled(); expect(f.storage.getSnapshot().cloud?.available).toBe(true)
    expect(f.storage.getSnapshot().state.data).toEqual(f.remote().document)
    expect(f.storage.getSnapshot().cloud?.base?.document).toEqual(f.remote().document)
  })
  it('keeps both preexisting divergent archives for review even before activation', async () => {
    const f = await fixture(false); f.storage.dispatch({ type: 'replace', data: make('older-cache') }); await f.storage.flush()
    f.job.read = async () => ({ ...f.remote(), mode: 'legacy' })
    expect(await runSync(f.job)).toBe('conflict'); expect(f.storage.getSnapshot().cloud?.conflict?.base).toBeNull()
    expect(f.storage.getSnapshot().cloud?.available).toBe(true); expect(f.write).not.toHaveBeenCalled()
  })
  it.each(['lower revision', 'reused revision'])('does not silently adopt an inconsistent server snapshot after %s', async kind => {
    const f = await fixture(); await add(f.storage, 'valid-newer-data'); await runSync(f.job)
    const base = clone(f.storage.getSnapshot().cloud!.base!)
    f.job.read = async () => ({ ...base, revision: kind === 'lower revision' ? '0' : base.revision, document: make('older-backup') })
    expect(await runSync(f.job)).toBe('conflict')
    expect(f.storage.getSnapshot().state.data?.transactions.some(t => t.id === 'valid-newer-data')).toBe(true)
    expect(f.storage.getSnapshot().cloud?.conflict?.remote.document?.transactions[0].id).toBe('older-backup')
  })
  it('preserves the full merged candidate when a pending write meets a rolled-back server', async () => {
    const f = await fixture(); await add(f.storage, 'local'); const remote = make('remote-known-before-rollback'); f.change(remote)
    let rolledBack = false
    f.job.read = async () => rolledBack ? { ...f.remote(), revision: '0', document: make() } : clone(f.remote())
    f.job.write = async p => { rolledBack = true; return { status: 'conflict', operation: p.id, revision: '0', replay: false } }
    expect(await runSync(f.job)).toBe('conflict')
    expect(f.storage.getSnapshot().cloud?.recovery.some(copy => copy.local?.transactions.some(t => t.id === 'remote-known-before-rollback'))).toBe(true)
  })
  it('blocks an ambiguous complete archive clear and preserves the remote copy for review', async () => {
    const f = await fixture(); f.storage.dispatch({ type: 'replace', data: null }); await f.storage.flush()
    expect(await runSync(f.job)).toBe('conflict'); expect(f.write).not.toHaveBeenCalled()
    expect(f.storage.getSnapshot().cloud?.conflict).toMatchObject({ local: null, remote: { document: f.remote().document } })
  })
  it('retries a transaction aborted with a PostgreSQL deadlock code using the same durable UUID', async () => {
    const f = await fixture(); await add(f.storage, 'deadlock'); let first = true; const seen: string[] = []
    f.job.write = async p => { seen.push(p.id); if (first) { first = false; throw new ProtocolError('deadlock detected', '40P01', 500) } return f.write(p) }
    expect(await runSync(f.job)).toBe('ok'); expect(seen).toHaveLength(2); expect(seen[0]).toBe(seen[1])
  })
  it('keeps data on server pause, unsupported version, authentication and invalid ACK', async () => {
    for (const code of ['QSYNC_PAUSED', 'QSYNC_UPGRADE_REQUIRED', 'PGRST202']) {
      db.values.clear(); const f = await fixture(); await add(f.storage, code)
      f.job.write = async () => { throw new ProtocolError(code, code, 409) }
      expect(await runSync(f.job)).toBe(code.includes('PAUSED') ? 'paused' : 'upgrade'); expect(f.storage.getSnapshot().cloud?.pending).toBeTruthy()
    }
  })
  it('records both versions before explicit conflict resolution and synchronizes after reload', async () => {
    const f = await fixture(); await add(f.storage, 'one'); await runSync(f.job)
    const other = clone(f.remote().document!); f.storage.dispatch({ type: 'updateTx', tx: { ...other.transactions[0], amount: 20 } }); await f.storage.flush(); other.transactions[0].amount = 30; f.change(other)
    expect(await runSync(f.job)).toBe('conflict')
    const conflict = f.storage.getSnapshot().cloud!.conflict!
    await f.storage.updateCloud(f.job.lease, ({ data, cloud }) => {
      cloud.recovery.push({ id: 'decision', at: new Date().toISOString(), reason: 'resolution', local: clone(data), remote: clone(conflict.remote.document), base: clone(conflict.base!.document) })
      cloud.base = clone(conflict.remote); cloud.conflict = null; cloud.status = 'pending'
      return { data: resolveConflict(conflict, { '/transactions/one': 'local' }), cloud }
    })
    const reopened = new AccountStore(scope); await reopened.ready; expect(await runSync({ ...f.job, storage: reopened })).toBe('ok')
    expect(f.remote().document?.transactions[0].amount).toBe(20); expect(reopened.getSnapshot().cloud?.recovery[0].remote?.transactions[0].amount).toBe(30)
  })
  it.each(['guest', 'demo', 'recovery', 'local'] as const)('never synchronizes %s scope', async kind => {
    const f = await fixture(false); f.job.lease = activateScope({ ...scope, kind })
    await expect(runSync(f.job)).rejects.toThrow('account'); expect(f.write).not.toHaveBeenCalled()
  })
})
