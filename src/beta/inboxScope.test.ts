import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateScope, personalKey } from '../store/scope'
import { inboxSnapshot, reloadInbox } from './inbox'

const db = vi.hoisted(() => ({ get: vi.fn(async (_key: string): Promise<unknown> => []) }))
vi.mock('idb-keyval', () => ({ get: (key: string) => db.get(key) }))
beforeEach(() => db.get.mockClear())
afterEach(() => vi.unstubAllGlobals())
it('reads only the active owner inbox, never the global legacy inbox', async () => {
  const lease = activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'B' })
  await reloadInbox()
  expect(db.get).toHaveBeenCalledWith(personalKey('quadriamo.inbox', lease.scope))
  expect(db.get).not.toHaveBeenCalledWith('quadriamo.inbox')
})
it('drops an inbox read that completes after the account changes', async () => {
  activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'A' })
  let finish!: (value: unknown) => void
  db.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = reloadInbox()
  activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'B' })
  finish([{ id: 'A-only', title: 'A-only', at: '2026-10-18', body: '', kind: 'message' }])
  await pending
  expect(inboxSnapshot()).toEqual([])
})
it('clears the prior snapshot even if the next account flags are malformed', async () => {
  activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'A' })
  db.get.mockResolvedValueOnce([{ id: 'A-only', title: 'A-only', at: '2026-10-18', body: '', kind: 'message', url: './app/' }])
  await reloadInbox()
  expect(inboxSnapshot()).toHaveLength(1)
  vi.stubGlobal('localStorage', { getItem: () => '{"read":"broken","important":null}' })
  activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'B' })
  expect(inboxSnapshot()).toEqual([])
})
