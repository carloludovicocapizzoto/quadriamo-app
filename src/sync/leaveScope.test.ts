import { expect, it, vi } from 'vitest'
import { activateScope } from '../store/scope'
import { leaveScope } from './leaveScope'

const scope = (owner: string) => ({ environment: 'test', backend: 'synthetic', kind: 'account' as const, owner })
it('invalidates the old UI before waiting for its pending saves', async () => {
  const lease = activateScope(scope('A')), action = vi.fn(async () => {}), suspended = vi.fn()
  let finish!: () => void
  const pending = leaveScope(lease, () => new Promise<void>(r => { finish = r }), action, suspended)
  expect(lease.current()).toBe(false)
  expect(lease.signal.aborted).toBe(true)
  expect(suspended).toHaveBeenCalledWith(expect.anything(), true)
  expect(action).not.toHaveBeenCalled()
  finish(); await pending
  expect(action).toHaveBeenCalledOnce()
})
it('does not leave or erase a cache when persistence fails', async () => {
  const action = vi.fn(async () => {}), suspended = vi.fn()
  await expect(leaveScope(activateScope(scope('A')), async () => { throw Error('quota') }, action, suspended)).rejects.toThrow('quota')
  expect(action).not.toHaveBeenCalled()
  expect(suspended).toHaveBeenLastCalledWith(expect.objectContaining({ scope: scope('A') }), false)
})
it('does not act or restore A after an externally imposed B session', async () => {
  const action = vi.fn(async () => {}), suspended = vi.fn()
  let finish!: () => void
  const pending = leaveScope(activateScope(scope('A')), () => new Promise<void>(r => { finish = r }), action, suspended)
  activateScope(scope('B')); finish()
  await expect(pending).rejects.toThrow('session changed')
  expect(action).not.toHaveBeenCalled()
  expect(suspended).toHaveBeenCalledTimes(1)
})
