import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { expect, it, vi } from 'vitest'
import { observeSession } from './observeSession'

const session = (id: string) => ({ user: { id } }) as Session
function source() {
  let finish!: (v: { data: { session: Session | null }; error: unknown }) => void
  let event!: (e: AuthChangeEvent, s: Session | null) => void
  const unsubscribe = vi.fn()
  const auth = {
    getSession: () => new Promise(r => { finish = r }),
    onAuthStateChange: (f: typeof event) => { event = f; return { data: { subscription: { unsubscribe } } } },
  } as unknown as SupabaseClient['auth']
  return { auth, finish: (s: Session | null) => finish({ data: { session: s }, error: null }),
    fail: (error: unknown) => finish({ data: { session: null }, error }),
    event: (e: AuthChangeEvent, s: Session | null) => event(e, s), unsubscribe }
}
it.each(['SIGNED_OUT', 'SIGNED_IN'] as const)('ignores a stale initial session after %s', async event => {
  const s = source(), change = vi.fn(), stop = observeSession(s.auth, change)
  const next = event === 'SIGNED_OUT' ? null : session('B')
  s.event(event, next); s.finish(session('A')); await Promise.resolve()
  expect(change).toHaveBeenCalledExactlyOnceWith(event, next)
  stop()
})
it('delivers token refreshes and user updates without inventing a sign-in event', () => {
  const s = source(), change = vi.fn(), stop = observeSession(s.auth, change)
  s.event('TOKEN_REFRESHED', session('A')); s.event('USER_UPDATED', session('A'))
  expect(change.mock.calls.map(c => c[0])).toEqual(['TOKEN_REFRESHED', 'USER_UPDATED'])
  stop()
})
it('does not update an unmounted authentication observer', async () => {
  const s = source(), change = vi.fn(), stop = observeSession(s.auth, change)
  stop(); s.event('SIGNED_IN', session('B')); s.finish(session('A')); await Promise.resolve()
  expect(change).not.toHaveBeenCalled()
  expect(s.unsubscribe).toHaveBeenCalledOnce()
})
it('opens the retained offline identity immediately without waiting for a failed refresh', async () => {
  const s = source(), change = vi.fn(), offline = () => session('A')
  const stop = observeSession(s.auth, change, { offline })
  expect(change).toHaveBeenCalledWith('INITIAL_SESSION', session('A'))
  s.finish(null); await Promise.resolve()
  expect(change).toHaveBeenLastCalledWith('INITIAL_SESSION', session('A'))
  stop()
})
it('ignores stale SDK broadcasts that do not match the current stored identity', () => {
  const s = source(), change = vi.fn(), stop = observeSession(s.auth, change, { current: value => value?.user.id === 'B' })
  s.event('SIGNED_IN', session('A')); s.event('SIGNED_OUT', null); s.event('SIGNED_IN', session('B'))
  expect(change).toHaveBeenCalledExactlyOnceWith('SIGNED_IN', session('B'))
  stop()
})
it('can recover local access on a network error even after an ignored empty SDK event', async () => {
  const s = source(), change = vi.fn(), network = Error('network unavailable')
  const stop = observeSession(s.auth, change, { current: value => value?.user.id === 'A', offline: (error?: unknown) => error === network ? session('A') : null })
  s.event('INITIAL_SESSION', null); s.fail(network); await Promise.resolve()
  expect(change).toHaveBeenCalledWith('INITIAL_SESSION', session('A'))
  stop()
})
it('bounds initial renewal so an unreachable server cannot indefinitely hide the retained local archive', async () => {
  vi.useFakeTimers()
  const s = source(), change = vi.fn()
  const stop = observeSession(s.auth, change, { offline: error => error ? session('A') : null })
  try { await vi.advanceTimersByTimeAsync(15000); expect(change).toHaveBeenCalledWith('INITIAL_SESSION', session('A')) }
  finally { stop(); vi.useRealTimers() }
})
