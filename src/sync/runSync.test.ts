import { describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../engine'
import { activateScope, type DataScope } from '../store/scope'
import type { AppData } from '../store/types'
import { runSync, type SyncJob } from './runSync'

const scope = (owner: string, kind: DataScope['kind'] = 'account'): DataScope => ({ environment: 'test', backend: 'synthetic', owner, kind })
const data = (id: string): AppData => ({ version: 1, settings: defaultSettings({ firstMonth: { year: 2026, month: 1 } }),
  transactions: [{ id, amount: 10, category: 'groceries', date: '2026-01-01', description: id }] })
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const job = (): SyncJob => ({
  lease: activateScope(scope('A')), local: () => data('A-local'), replace: vi.fn(),
  flush: vi.fn(async () => {}), fetch: vi.fn(async () => data('A-remote')), push: vi.fn(async () => {}),
})

describe('session-bound synchronization', () => {
  it('ignores an A download completed after login B', async () => {
    const j = job(), response = deferred<AppData>()
    j.fetch = vi.fn(() => response.promise)
    const running = runSync(j)
    await Promise.resolve()
    activateScope(scope('B'))
    response.resolve(data('A-remote'))
    expect(await running).toBe(false)
    expect(j.replace).not.toHaveBeenCalled()
    expect(j.push).not.toHaveBeenCalled()
  })
  it('A→B→A never revives jobs from the first A session', async () => {
    const j = job(), response = deferred<AppData>()
    j.fetch = () => response.promise
    const running = runSync(j)
    await Promise.resolve()
    activateScope(scope('B')); activateScope(scope('A'))
    response.resolve(data('old-A'))
    expect(await running).toBe(false)
    expect(j.push).not.toHaveBeenCalled()
    expect(j.lease.signal.aborted).toBe(true)
  })
  it('does not upload if the session changes while saving the merged cache', async () => {
    const j = job(), save = deferred<void>()
    let n = 0
    j.flush = async () => { if (++n === 2) await save.promise }
    const running = runSync(j)
    await vi.waitFor(() => expect(j.replace).toHaveBeenCalled())
    activateScope(scope('B')); save.resolve()
    expect(await running).toBe(false)
    expect(j.push).not.toHaveBeenCalled()
  })
  it('does not report success for an upload acknowledged after logout', async () => {
    const j = job(), upload = deferred<void>()
    j.push = vi.fn(() => upload.promise)
    const running = runSync(j)
    await vi.waitFor(() => expect(j.push).toHaveBeenCalled())
    activateScope(scope('guest', 'guest')); upload.resolve()
    expect(await running).toBe(false)
  })
  it('includes edits made during download within the same account', async () => {
    const j = job(), response = deferred<AppData>()
    let local = data('before')
    j.local = () => local; j.fetch = () => response.promise
    const running = runSync(j)
    await Promise.resolve()
    local = data('during')
    response.resolve(data('remote'))
    expect(await running).toBe(true)
    expect(j.push).toHaveBeenCalledWith(expect.objectContaining({ transactions: expect.arrayContaining([
      expect.objectContaining({ id: 'during' }), expect.objectContaining({ id: 'remote' }),
    ]) }))
  })
  it.each(['demo', 'recovery', 'guest', 'local'] as const)('never syncs a %s scope', async kind => {
    const j = job()
    j.lease = activateScope(scope('isolated', kind))
    expect(await runSync(j)).toBe(false)
    expect(j.fetch).not.toHaveBeenCalled()
    expect(j.push).not.toHaveBeenCalled()
  })
  it('stops before reading remote data if the local cache cannot be saved', async () => {
    const j = job()
    j.flush = async () => { throw Error('quota') }
    await expect(runSync(j)).rejects.toThrow('quota')
    expect(j.fetch).not.toHaveBeenCalled()
  })
  it('rejects demo and future schemas received from remote', async () => {
    for (const remote of [{ ...data('demo'), demo: true }, { ...data('future'), version: 99 }]) {
      const j = job()
      j.fetch = async () => remote as AppData
      await expect(runSync(j)).rejects.toThrow('unsupported')
      expect(j.replace).not.toHaveBeenCalled()
      expect(j.push).not.toHaveBeenCalled()
    }
  })
})
