import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { expect, it, vi } from 'vitest'
import { observeSession } from './observeSession'

const session = (id: string) => ({ user: { id } }) as Session
function source() {
  let finish!: (v: { data: { session: Session | null }; error: null }) => void
  let event!: (e: AuthChangeEvent, s: Session | null) => void
  const unsubscribe = vi.fn()
  const auth = {
    getSession: () => new Promise(r => { finish = r }),
    onAuthStateChange: (f: typeof event) => { event = f; return { data: { subscription: { unsubscribe } } } },
  } as unknown as SupabaseClient['auth']
  return { auth, finish: (s: Session | null) => finish({ data: { session: s }, error: null }),
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
