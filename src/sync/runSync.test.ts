import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import { activateScope } from '../store/scope'
import { AccountStore } from '../store/accountStore'
import { restoreLoss } from '../store/backup'
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
  let server: RemoteDocument = { protocol: 2, revision: '1', mode: 'protected', document: make() }
  const receipts = new Map<string, { revision: string; document: AppData }>()
  const read = vi.fn(async () => clone(server))
  const write = vi.fn(async (pending: Parameters<SyncJob['write']>[0]) => {
    const previous = receipts.get(pending.id)
    if (previous) { if (!equal(previous.document, pending.document)) throw Error('idempotency mismatch'); return { protocol: 2 as const, operation: pending.id, status: 'applied' as const, revision: previous.revision, replay: true } }
    if (pending.expected !== server.revision) return { protocol: 2 as const, operation: pending.id, status: 'conflict' as const, revision: server.revision, replay: false }
    server = { ...server, document: clone(pending.document), revision: String(BigInt(server.revision) + 1n) }
    receipts.set(pending.id, { revision: server.revision, document: clone(pending.document) })
    return { protocol: 2 as const, operation: pending.id, status: 'applied' as const, revision: server.revision, replay: false }
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
  it('keeps the same outbox during rate limiting and waits for retry-after before sending again', async () => {
    const f = await fixture(); await add(f.storage, 'rate-limited')
    const original = vi.fn(async () => { throw new ProtocolError('QSYNC_RATE_LIMITED', 'QSYNC_RATE_LIMITED', 429, { retry_after_seconds: 3600 }) })
    f.job.write = original
    expect(await runSync(f.job)).toBe('pending')
    const before = f.storage.getSnapshot().cloud!.pending!
    expect(f.storage.getSnapshot().cloud?.cooldownUntil).toBeTruthy()
    expect(original).toHaveBeenCalledTimes(1)
    f.job.write = f.write
    expect(await runSync(f.job)).toBe('pending')
    expect(f.write).not.toHaveBeenCalled()
    await f.storage.updateCloud(f.job.lease, ({ data, cloud }) => { cloud.cooldownUntil = new Date(Date.now() - 1000).toISOString(); return { data, cloud } })
    expect(await runSync(f.job)).toBe('ok')
    expect(f.write.mock.calls[0][0].id).toBe(before.id)
  })
  it('re-reads and conservatively reconciles after a receipt expires instead of resending its UUID', async () => {
    const f = await fixture(); await add(f.storage, 'after-expiry')
    f.job.write = async () => { throw new ProtocolError('QSYNC_RECEIPT_EXPIRED', 'QSYNC_RECEIPT_EXPIRED', 409) }
    expect(await runSync(f.job)).toBe('pending')
    const cloud = f.storage.getSnapshot().cloud!
    expect(cloud.recovery.at(-1)).toMatchObject({ reason: 'expired-receipt', local: { transactions: [{ id: 'after-expiry' }] } })
    expect(cloud.pending?.id).not.toBe(cloud.recovery.at(-1)?.id)
    expect(cloud.pending?.expected).toBe('1')
  })
  it('reports converged state separately when the remote already has an expired pending document', async () => {
    const f = await fixture(); await add(f.storage, 'already-present')
    f.job.write = async p => { f.change(p.document); throw new ProtocolError('QSYNC_RECEIPT_EXPIRED', 'QSYNC_RECEIPT_EXPIRED', 409) }
    expect(await runSync(f.job)).toBe('reconciled')
    expect(f.storage.getSnapshot().cloud?.pending).toBeNull()
    expect(f.storage.getSnapshot().cloud?.lastAck).toBeUndefined()
    expect(f.storage.getSnapshot().cloud?.recovery.at(-1)?.reason).toBe('expired-receipt')
  })
  it('includes edits made after outbox creation when reconciling an expired receipt', async () => {
    const f = await fixture(); await add(f.storage, 'first'); f.change(make('remote-before'))
    f.job.write = async () => {
      await add(f.storage, 'second'); f.change(make('remote-before', 'remote-after'))
      throw new ProtocolError('QSYNC_RECEIPT_EXPIRED', 'QSYNC_RECEIPT_EXPIRED', 409)
    }
    expect(await runSync(f.job)).toBe('pending')
    expect(f.storage.getSnapshot().cloud?.pending?.document.transactions.map(t => t.id).sort())
      .toEqual(['first', 'remote-after', 'remote-before', 'second'])
    f.job.write = f.write
    expect(await runSync(f.job)).toBe('ok')
    expect(f.remote().document?.transactions.map(t => t.id).sort()).toEqual(['first', 'remote-after', 'remote-before', 'second'])
    expect(f.storage.getSnapshot().state.data?.transactions.map(t => t.id).sort()).toEqual(['first', 'remote-after', 'remote-before', 'second'])
  })
  it('preserves current and pending versions when expiry recovery finds conflicting edits', async () => {
    const f = await fixture(); await add(f.storage, 'one'); await runSync(f.job)
    f.storage.dispatch({ type: 'updateTx', tx: { ...make('one').transactions[0], amount: 20 }, at: '2100-01-01' }); await f.storage.flush()
    f.job.write = async () => {
      f.storage.dispatch({ type: 'updateTx', tx: { ...make('one').transactions[0], amount: 40 }, at: '2100-01-02' }); await f.storage.flush()
      const other = make('one'); other.transactions[0].amount = 30; f.change(other)
      throw new ProtocolError('QSYNC_RECEIPT_EXPIRED', 'QSYNC_RECEIPT_EXPIRED', 409)
    }
    expect(await runSync(f.job)).toBe('conflict')
    expect(f.storage.getSnapshot().cloud?.conflict).toMatchObject({ cause: 'expired-receipt', paths: ['/document'], local: { transactions: [{ amount: 40 }] } })
    expect(f.storage.getSnapshot().cloud?.recovery.some(copy => copy.local?.transactions[0].amount === 20)).toBe(true)
    expect(f.storage.getSnapshot().cloud?.recovery.some(copy => copy.local?.transactions[0].amount === 40)).toBe(true)
    expect(f.storage.getSnapshot().state.data?.transactions[0].amount).toBe(40)
  })
  it('does not replace an expired outbox while the reread reports a paused backend', async () => {
    const f = await fixture(); await add(f.storage, 'paused-expiry')
    let expired = false
    f.job.read = async () => ({ ...clone(f.remote()), mode: expired ? 'paused' : 'protected' })
    f.job.write = async () => {
      expired = true
      throw new ProtocolError('QSYNC_RECEIPT_EXPIRED', 'QSYNC_RECEIPT_EXPIRED', 409)
    }
    expect(await runSync(f.job)).toBe('paused')
    expect(f.storage.getSnapshot().cloud?.pending?.document.transactions[0].id).toBe('paused-expiry')
    expect(f.storage.getSnapshot().cloud?.recovery).toHaveLength(0)
  })
  it('keeps later edits pending when the expired candidate already exists remotely', async () => {
    const f = await fixture(); await add(f.storage, 'accepted')
    f.job.write = async p => {
      f.change(p.document); await add(f.storage, 'newer')
      throw new ProtocolError('QSYNC_RECEIPT_EXPIRED', 'QSYNC_RECEIPT_EXPIRED', 409)
    }
    expect(await runSync(f.job)).toBe('pending')
    expect(f.storage.getSnapshot().cloud?.lastAck).toBeUndefined()
    expect(f.storage.getSnapshot().cloud?.pending?.document.transactions.map(t => t.id)).toEqual(['accepted', 'newer'])
    f.job.write = f.write
    expect(await runSync(f.job)).toBe('ok')
    expect(f.remote().document?.transactions.map(t => t.id)).toEqual(['accepted', 'newer'])
  })
  it('keeps a rejected oversized document and outbox exportable on this device', async () => {
    const f = await fixture(); await add(f.storage, 'too-large')
    f.job.write = async () => { throw new ProtocolError('QSYNC_DOCUMENT_TOO_LARGE', 'QSYNC_DOCUMENT_TOO_LARGE', 413) }
    await expect(runSync(f.job)).rejects.toMatchObject({ code: 'QSYNC_DOCUMENT_TOO_LARGE', status: 413 })
    expect(f.storage.getSnapshot().cloud?.pending?.document.transactions[0].id).toBe('too-large')
    expect((await loadData(scope)).kind).toBe('found')
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
    activateScope({ ...scope, owner: 'B' }); activateScope(scope); held.resolve({ protocol: 2, status: 'applied', operation: '', revision: '0', replay: false })
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
    f.job.write = async p => { rolledBack = true; return { protocol: 2, status: 'conflict', operation: p.id, revision: '0', replay: false } }
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

// REG (2026-10-21): the phone adds subscriptions, the PC still holds the previous revision and refreshes the
// exchange rates on start. The phone is simulated through the same CAS server (expected revision + receipts).
describe('REG: old PC copy + automatic exchange rates + CAS', () => {
  const sub = (id: string, title: string) => ({ id, kind: 'subscription' as const, title, amount: 9.99, category: 'fixedCosts', date: '2026-10-05',
    repeat: { every: 1, unit: 'month' as const }, until: null, done: [], active: true })
  const phoneWrites = async (f: Awaited<ReturnType<typeof fixture>>, change: (d: AppData) => void) => {
    const next = clone(f.remote().document!); change(next)
    const receipt = await f.write({ id: crypto.randomUUID(), expected: f.remote().revision, document: next, localAtStart: null })
    expect(receipt).toMatchObject({ status: 'applied', replay: false })
  }
  const addSubs = (d: AppData) => { d.settings.events.push(sub('s1', 'Netflix'), sub('s2', 'Spotify')); d.settingsUpdatedAt = '2026-10-20T10:00:00.000Z' }
  const titles = (d: AppData | null | undefined) => (d?.settings.events ?? []).map(e => e.title).sort()
  const refreshRates = async (storage: AccountStore) => {
    storage.dispatch({ type: 'setFx', currency: storage.getSnapshot().state.data!.settings.currency, rates: { USD: 1.08 }, date: '2026-10-21' }); await storage.flush()
  }

  it('rates refreshed before the read: the cloud keeps the subscriptions and gets the rates, without a conflict', async () => {
    const f = await fixture(); await phoneWrites(f, addSubs); await refreshRates(f.storage)
    expect(await runSync(f.job)).toBe('ok')
    expect(titles(f.remote().document)).toEqual(['Netflix', 'Spotify']); expect(f.remote().document?.settings.fxDate).toBe('2026-10-21')
    expect(titles(f.storage.getSnapshot().state.data)).toEqual(['Netflix', 'Spotify'])
  })
  it('the phone writes while the PC upload is in flight: stale revision → re-read → merge, nothing lost', async () => {
    const f = await fixture(); await refreshRates(f.storage); let first = true
    f.job.write = async p => { if (first) { first = false; await phoneWrites(f, addSubs) } return f.write(p) }
    expect(await runSync(f.job)).toBe('ok')
    expect(await f.write.mock.results[1].value).toMatchObject({ status: 'conflict' })   // [0] = the phone, [1] = the stale PC write
    expect(titles(f.remote().document)).toEqual(['Netflix', 'Spotify']); expect(f.remote().document?.settings.fxDate).toBe('2026-10-21')
  })
  it('lost response after commit: the same operation is replayed once, no duplicate revision or event', async () => {
    const f = await fixture(); await phoneWrites(f, addSubs); await refreshRates(f.storage); let first = true
    f.job.write = async p => { const r = await f.write(p); if (first) { first = false; throw new TypeError('lost response after commit') } return r }
    expect(await runSync(f.job)).toBe('ok'); expect(f.remote().revision).toBe('3')
    expect(f.write.mock.calls.at(-1)![0]).toEqual(f.write.mock.calls.at(-2)![0])
    expect(await f.write.mock.results.at(-1)!.value).toMatchObject({ replay: true })
    expect(f.remote().document?.settings.events.map(e => e.id).sort()).toEqual(['s1', 's2'])
  })
  it('lost response, then the app is closed and reopened: the same operation is replayed, one revision, nothing lost', async () => {
    const f = await fixture(); await phoneWrites(f, addSubs); await refreshRates(f.storage)
    f.job.write = async p => { await f.write(p); throw new TypeError('lost response after commit') }
    expect(await runSync(f.job)).toBe('pending')                                   // three attempts, all answers lost
    const revision = f.remote().revision, pending = f.storage.getSnapshot().cloud!.pending!
    const reopened = new AccountStore(scope); await reopened.ready                  // app closed and opened again
    expect(reopened.getSnapshot().cloud?.pending?.id).toBe(pending.id)
    expect(await runSync({ ...f.job, storage: reopened, write: f.write })).toBe('ok')
    expect(f.remote().revision).toBe(revision); expect(await f.write.mock.results.at(-1)!.value).toMatchObject({ replay: true })
    expect(titles(f.remote().document)).toEqual(['Netflix', 'Spotify']); expect(f.remote().document?.settings.fxDate).toBe('2026-10-21')
  })
  it('a subscription removed on the phone is not resurrected by the PC', async () => {
    const f = await fixture(); await phoneWrites(f, addSubs); expect(await runSync(f.job)).toBe('ok')
    await phoneWrites(f, d => { d.settings.events = d.settings.events.filter(e => e.id !== 's1') }); await refreshRates(f.storage)
    expect(await runSync(f.job)).toBe('ok'); expect(titles(f.remote().document)).toEqual(['Spotify'])
  })
  it('a clash on another setting: only that field is asked, and the cloud-only subscriptions survive choosing this device', async () => {
    const f = await fixture()
    const local = f.storage.getSnapshot().state.data!
    f.storage.dispatch({ type: 'setSettings', settings: { ...local.settings, monthStartDay: 10 } }); await f.storage.flush(); await refreshRates(f.storage)
    await phoneWrites(f, d => { addSubs(d); d.settings.monthStartDay = 27 })
    expect(await runSync(f.job)).toBe('conflict')
    const conflict = f.storage.getSnapshot().cloud!.conflict!
    expect(conflict.paths).toEqual(['/settings/monthStartDay'])
    await f.storage.updateCloud(f.job.lease, ({ cloud }) => {
      cloud.base = clone(conflict.remote); cloud.conflict = null; cloud.status = 'pending'
      return { data: resolveConflict(conflict, { '/settings/monthStartDay': 'local' }), cloud }
    })
    expect(await runSync(f.job)).toBe('ok')
    expect(f.remote().document?.settings).toMatchObject({ monthStartDay: 10, fxDate: '2026-10-21' })
    expect(titles(f.remote().document)).toEqual(['Netflix', 'Spotify']); expect(titles(f.storage.getSnapshot().state.data)).toEqual(['Netflix', 'Spotify'])
  })
  it('restoring an old backup: the phone\'s new subscription survives, what the backup lacks is removed on purpose and kept for export', async () => {
    const f = await fixture(); await phoneWrites(f, addSubs); expect(await runSync(f.job)).toBe('ok')
    const backup = clone(f.storage.getSnapshot().state.data!); backup.settings.events = []            // an old backup, before the subscriptions
    await phoneWrites(f, d => { d.settings.events.push(sub('s3', 'Disney+')) })                           // meanwhile the phone adds one
    expect(restoreLoss(f.storage.getSnapshot().state.data, backup)).toEqual({ transactions: 0, events: 2 })
    await f.storage.updateCloud(f.job.lease, ({ data, cloud }) => {
      cloud.recovery.push({ id: 'restore', at: new Date().toISOString(), reason: 'restore', local: data, remote: null, base: cloud.base?.document ?? null })
      return { data: backup, cloud }
    })
    expect(await runSync(f.job)).toBe('ok')
    expect(titles(f.remote().document)).toEqual(['Disney+'])
    expect(titles(f.storage.getSnapshot().cloud!.recovery.find(r => r.reason === 'restore')!.local)).toEqual(['Netflix', 'Spotify'])
  })
  it('edit on the PC vs removal on the phone: a question about that event only, then both devices converge', async () => {
    const f = await fixture(); await phoneWrites(f, addSubs); expect(await runSync(f.job)).toBe('ok')
    const local = f.storage.getSnapshot().state.data!
    f.storage.dispatch({ type: 'setSettings', settings: { ...local.settings, events: local.settings.events.map(e => e.id === 's1' ? { ...e, amount: 12.99 } : e) } })
    await f.storage.flush(); await refreshRates(f.storage)
    await phoneWrites(f, d => { d.settings.events = d.settings.events.filter(e => e.id !== 's1') })
    expect(await runSync(f.job)).toBe('conflict')
    const conflict = f.storage.getSnapshot().cloud!.conflict!
    expect(conflict.paths).toEqual(['/settings/events/s1'])
    await f.storage.updateCloud(f.job.lease, ({ cloud }) => {
      cloud.base = clone(conflict.remote); cloud.conflict = null; cloud.status = 'pending'
      return { data: resolveConflict(conflict, { '/settings/events/s1': 'local' }), cloud }
    })
    expect(await runSync(f.job)).toBe('ok')
    expect(f.remote().document?.settings.events.find(e => e.id === 's1')?.amount).toBe(12.99)
    expect(titles(f.remote().document)).toEqual(['Netflix', 'Spotify']); expect(f.remote().document?.settings.fxDate).toBe('2026-10-21')
  })
})

