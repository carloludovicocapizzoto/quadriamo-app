import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import type { AppData } from './types'
import { archiveLegacy, LEGACY_ARCHIVE, legacyCopies, loadData, recoverLegacy, saveData, StorageConflict } from './persist'
import { dataKey } from './scope'
import { AccountStore } from './accountStore'
import { emptyCloud } from '../sync/protocol'

const db = vi.hoisted(() => ({ values: new Map<string, unknown>(), failRead: false, failWrite: false, crashAfterWrite: false }))
vi.mock('idb-keyval', () => ({
  get: async (key: string) => { if (db.failRead) throw Error('read'); return structuredClone(db.values.get(key)) },
  set: async (key: string, value: unknown) => { if (db.failWrite) throw Error('quota'); db.values.set(key, structuredClone(value)) },
  del: async (key: string) => { db.values.delete(key) },
  update: async (key: string, fn: (x: unknown) => unknown) => {
    if (db.failWrite) throw Error('quota')
    db.values.set(key, structuredClone(fn(structuredClone(db.values.get(key)))))
    if (db.crashAfterWrite) throw Error('crash after commit')
  },
}))
const scope = { environment: 'test', backend: 'local', kind: 'account' as const, owner: 'B' }
const legacy: AppData = { version: 1, settings: defaultSettings({ firstMonth: { year: 2026, month: 1 } }),
  transactions: [{ id: 'A-only', date: '2026-01-01', amount: 10, category: 'groceries', description: 'A-only' }] }
beforeEach(() => { db.values.clear(); db.failRead = false; db.failWrite = false; db.crashAfterWrite = false })

describe('account cache boundaries', () => {
  it('atomically stores cloud base/outbox with financial data and retains the exact older envelope', async () => {
    await saveData(scope, legacy, 0)
    const original = structuredClone(db.values.get(dataKey(scope)))
    const cloud = emptyCloud(); cloud.pending = { id: 'operation', expected: '4', document: legacy, localAtStart: legacy }; cloud.status = 'pending'
    await saveData(scope, legacy, 1, cloud)
    expect(await loadData(scope)).toMatchObject({ data: legacy, cloud })
    expect(db.values.get(dataKey(scope))).toMatchObject({ storageFormat: 3, previous: original })
    await expect(saveData(scope, legacy, 2)).rejects.toThrow()
  })
  it('a failed cloud metadata save preserves the last complete financial envelope', async () => {
    await saveData(scope, legacy, 0)
    const original = structuredClone(db.values.get(dataKey(scope)))
    db.failWrite = true
    await expect(saveData(scope, { ...legacy, transactions: [] }, 1, emptyCloud())).rejects.toThrow()
    expect(db.values.get(dataKey(scope))).toEqual(original)
  })
  it('tampering with cloud base or outbox fails verification rather than dropping metadata', async () => {
    await saveData(scope, legacy, 0, emptyCloud())
    const envelope = db.values.get(dataKey(scope)) as { cloud: { status: string } }
    envelope.cloud.status = 'ok'
    expect(await loadData(scope)).toMatchObject({ kind: 'corrupt' })
  })
  it('never loads the unowned legacy budget as B account data', async () => {
    db.values.set('quadriamo.data.v1', structuredClone(legacy))
    expect(await loadData(scope)).toMatchObject({ kind: 'empty', revision: 0 })
    expect(db.values.get('quadriamo.data.v1')).toEqual(legacy)
  })
  it('distinguishes storage errors from an empty account', async () => {
    db.failRead = true
    expect(await loadData(scope)).toMatchObject({ kind: 'unavailable' })
  })
  it('preserves legacy copies across retries and failed migrations', async () => {
    db.values.set('quadriamo.data.v1', structuredClone(legacy))
    db.failWrite = true
    expect(await loadData(scope)).toMatchObject({ kind: 'unavailable' })
    expect(db.values.get('quadriamo.data.v1')).toEqual(legacy)
    db.failWrite = false
    const copy = await archiveLegacy()
    await archiveLegacy()
    expect(await legacyCopies()).toHaveLength(1)
    expect(await recoverLegacy(copy!.id)).toEqual(legacy)
    expect(await loadData(scope)).toMatchObject({ kind: 'empty' })
    db.values.set('quadriamo.data.v1', { ...legacy, transactions: [] })
    await archiveLegacy()
    expect(await legacyCopies()).toHaveLength(2)
    expect((db.values.get(LEGACY_ARCHIVE) as { copies: unknown[] }).copies).toHaveLength(2)
  })
  it('stores A, B, demo and environments independently and leaves AppData v1 intact', async () => {
    const a = { ...scope, owner: 'A' }
    const demo = { ...scope, kind: 'demo' as const, owner: null }
    await saveData(a, legacy, 0)
    await saveData(scope, { ...legacy, transactions: [] }, 0)
    await saveData(demo, { ...legacy, demo: true }, 0)
    expect(await loadData(a)).toMatchObject({ kind: 'found', data: legacy })
    expect(await loadData(scope)).toMatchObject({ kind: 'found', data: { transactions: [] } })
    expect(await loadData({ ...a, environment: 'other' })).toMatchObject({ kind: 'empty' })
    expect(await loadData(demo)).toMatchObject({ kind: 'found', data: { demo: true } })
    await expect(saveData(a, { ...legacy, demo: true }, 1)).rejects.toThrow()
  })
  it('can read a verified legacy archive and owned cache when no further writes are possible', async () => {
    db.values.set('quadriamo.data.v1', structuredClone(legacy))
    await archiveLegacy()
    await saveData(scope, legacy, 0)
    db.failWrite = true
    expect(await loadData(scope)).toMatchObject({ kind: 'found', data: legacy })
  })
  it('detects owner mismatch, tampering and unsupported versions instead of overwriting', async () => {
    await saveData(scope, legacy, 0)
    const key = dataKey(scope)
    const saved = structuredClone(db.values.get(key)) as Record<string, unknown>
    db.values.set(key, { ...saved, scope: 'other' })
    expect(await loadData(scope)).toMatchObject({ kind: 'corrupt' })
    db.values.set(key, { ...saved, payload: null })
    expect(await loadData(scope)).toMatchObject({ kind: 'corrupt' })
    db.values.set(key, { ...saved, storageFormat: 99 })
    expect(await loadData(scope)).toMatchObject({ kind: 'unsupported' })
  })
  it('rejects stale writes from another tab, including after a reset', async () => {
    expect(await saveData(scope, legacy, 0)).toBe(1)
    await expect(saveData(scope, null, 0)).rejects.toBeInstanceOf(StorageConflict)
    expect(await saveData(scope, null, 1)).toBe(2)
    await expect(saveData(scope, legacy, 1)).rejects.toBeInstanceOf(StorageConflict)
    expect(await loadData(scope)).toMatchObject({ kind: 'empty', revision: 2 })
  })
  it('adopts an identical concurrent save without rewriting the newer envelope', async () => {
    await saveData(scope, legacy, 0)
    const before = structuredClone(db.values.get(dataKey(scope)))
    expect(await saveData(scope, structuredClone(legacy), 0)).toBe(1)
    expect(db.values.get(dataKey(scope))).toEqual(before)
    await expect(saveData(scope, { ...legacy, transactions: [] }, 0)).rejects.toBeInstanceOf(StorageConflict)
  })
  it('two first-load controllers can persist the same remote document and then detect different edits', async () => {
    const first = new AccountStore(scope), second = new AccountStore(scope)
    await Promise.all([first.ready, second.ready])
    first.dispatch({ type: 'replace', data: legacy })
    await first.flush()
    second.dispatch({ type: 'replace', data: structuredClone(legacy) })
    await second.flush()
    expect(second.getSnapshot()).toMatchObject({ error: null, dirty: false })
    first.dispatch({ type: 'addTx', tx: { ...legacy.transactions[0], id: 'one' } })
    await first.flush()
    second.dispatch({ type: 'addTx', tx: { ...legacy.transactions[0], id: 'two' } })
    await expect(second.flush()).rejects.toThrow()
    expect(second.getSnapshot()).toMatchObject({ error: 'conflict', dirty: true })
    expect(second.getSnapshot().state.data!.transactions.at(-1)!.id).toBe('two')
  })
  it('never adopts an identical payload from an unsupported or corrupted envelope', async () => {
    await saveData(scope, legacy, 0)
    const key = dataKey(scope), valid = structuredClone(db.values.get(key)) as Record<string, unknown>
    for (const patch of [{ checksum: 'corrupt' }, { payloadSchema: 99 }]) {
      const invalid = { ...valid, ...patch }
      db.values.set(key, invalid)
      await expect(saveData(scope, structuredClone(legacy), 0)).rejects.toBeInstanceOf(StorageConflict)
      expect(db.values.get(key)).toEqual(invalid)
    }
  })
  it('serializes edits and keeps unsaved data on quota failure', async () => {
    const store = new AccountStore(scope)
    await store.ready
    store.dispatch({ type: 'replace', data: legacy })
    store.dispatch({ type: 'addTx', tx: { ...legacy.transactions[0], id: 'second' } })
    await store.flush()
    expect(await loadData(scope)).toMatchObject({ kind: 'found', data: { transactions: [{ id: 'A-only' }, { id: 'second' }] } })
    db.failWrite = true
    store.dispatch({ type: 'addTx', tx: { ...legacy.transactions[0], id: 'unsaved' } })
    await expect(store.flush()).rejects.toThrow()
    expect(store.getSnapshot()).toMatchObject({ error: 'save', dirty: true })
    expect(store.getSnapshot().state.data!.transactions.at(-1)!.id).toBe('unsaved')
    db.failWrite = false
    await store.retry()
    expect(await loadData(scope)).toMatchObject({ kind: 'found', data: { transactions: expect.arrayContaining([expect.objectContaining({ id: 'unsaved' })]) } })
  })
  it('two tab controllers never overwrite one another or discard the losing edits', async () => {
    await saveData(scope, legacy, 0)
    const first = new AccountStore(scope), second = new AccountStore(scope)
    await Promise.all([first.ready, second.ready])
    first.dispatch({ type: 'addTx', tx: { ...legacy.transactions[0], id: 'tab-one' } })
    await first.flush()
    second.dispatch({ type: 'addTx', tx: { ...legacy.transactions[0], id: 'tab-two' } })
    await expect(second.flush()).rejects.toThrow()
    expect(second.getSnapshot().state.data!.transactions.at(-1)!.id).toBe('tab-two')
    expect(await loadData(scope)).toMatchObject({ data: { transactions: expect.arrayContaining([expect.objectContaining({ id: 'tab-one' })]) } })
    expect(second.getSnapshot().error).toBe('conflict')
    const reopened = new AccountStore(scope); await reopened.ready
    expect(reopened.getSnapshot().cloud?.recovery).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'local-conflict',
      local: expect.objectContaining({ transactions: expect.arrayContaining([expect.objectContaining({ id: 'tab-two' })]) }) })]))
  })
  it('A offline → logout → B → A conserves both caches without exposing the legacy budget', async () => {
    db.values.set('quadriamo.data.v1', structuredClone(legacy))
    const a = { ...scope, owner: 'A' }
    const first = new AccountStore(a), b = new AccountStore(scope)
    await Promise.all([first.ready, b.ready])
    expect(b.getSnapshot().state.data).toBeNull()
    first.dispatch({ type: 'replace', data: legacy })
    await first.flush()
    b.dispatch({ type: 'replace', data: { ...legacy, transactions: [{ ...legacy.transactions[0], id: 'B-only' }] } })
    await b.flush()
    const returning = new AccountStore(a)
    await returning.ready
    expect(returning.getSnapshot().state.data?.transactions.map(t => t.id)).toEqual(['A-only'])
    expect(b.getSnapshot().state.data?.transactions.map(t => t.id)).toEqual(['B-only'])
    expect(db.values.get('quadriamo.data.v1')).toEqual(legacy)
  })
  it('recovers idempotently from interruption after the atomic archive write', async () => {
    db.values.set('quadriamo.data.v1', structuredClone(legacy))
    db.crashAfterWrite = true
    expect(await loadData(scope)).toMatchObject({ kind: 'unavailable' })
    db.crashAfterWrite = false
    expect(await loadData(scope)).toMatchObject({ kind: 'empty' })
    const copies = await legacyCopies()
    expect(copies).toHaveLength(1)
    expect(await recoverLegacy(copies[0].id)).toEqual(legacy)
    expect(db.values.get('quadriamo.data.v1')).toEqual(legacy)
  })
  it('detects a corrupted legacy archive and never initializes a replacement account', async () => {
    db.values.set('quadriamo.data.v1', structuredClone(legacy))
    const copy = await archiveLegacy()
    const corrupted = { ...copy!, values: { 'quadriamo.data.v1': null } }
    db.values.set(LEGACY_ARCHIVE, { format: 2, copies: [corrupted] })
    expect(await loadData(scope)).toMatchObject({ kind: 'unavailable' })
    expect(db.values.has(dataKey(scope))).toBe(false)
    expect(db.values.get('quadriamo.data.v1')).toEqual(legacy)
  })
  it('archives the whole original document and accessory stores without normalizing or removing fields', async () => {
    const original = { ...legacy, deleted: { old: '2026-01-01' }, profileUpdatedAt: '2026-01-02',
      retainedUnknownField: { values: [0.00123456, 'original'] } }
    const morning = { currency: 'EUR', items: [{ name: 'A-only', free: 123.4567 }] }
    const notifications = [{ title: 'A-only', body: 'original' }]
    db.values.set('quadriamo.data.v1', original)
    db.values.set('quadriamo.morning', morning)
    db.values.set('quadriamo.inbox', notifications)
    const copy = await archiveLegacy()
    expect(copy!.values).toEqual({ 'quadriamo.data.v1': original, 'quadriamo.morning': morning, 'quadriamo.inbox': notifications })
    expect(await recoverLegacy(copy!.id)).toEqual(original)
    expect(db.values.get('quadriamo.morning')).toEqual(morning)
    expect(db.values.get('quadriamo.inbox')).toEqual(notifications)
  })
  it('retry cannot overwrite an unreadable newer document received from another tab', async () => {
    await saveData(scope, legacy, 0)
    const store = new AccountStore(scope)
    await store.ready
    const malformed = { ...legacy, settings: { ...legacy.settings, schema: 0, categories: [null] } } as unknown as AppData
    await saveData(scope, malformed, 1)
    await store.refresh()
    expect(store.getSnapshot().error).toBe('load')
    await store.retry().catch(() => undefined)
    expect((db.values.get(dataKey(scope)) as { payload: unknown }).payload).toEqual(malformed)
  })
})
