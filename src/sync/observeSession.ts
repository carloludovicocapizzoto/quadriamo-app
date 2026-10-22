import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { AuthRetryableFetchError } from '@supabase/supabase-js'

/** Un risultato iniziale tardivo non può prevalere su un evento auth più recente. */
export function observeSession(auth: SupabaseClient['auth'], changed: (event: AuthChangeEvent, session: Session | null) => void,
  options: { offline?: (error?: unknown) => Session | null; current?: (session: Session | null) => boolean } = {}) {
  let alive = true, revision = 0
  const publish = (event: AuthChangeEvent, session: Session | null, error?: unknown) => {
    const next = event === 'INITIAL_SESSION' && !session ? options.offline?.(error) ?? null : session
    if (options.current && !options.current(next)) return false
    changed(event, next); return true
  }
  const offline = options.offline?.()
  if (offline) publish('INITIAL_SESSION', offline)
  const initial = revision
  const deadline = setTimeout(() => {
    if (alive && revision === initial) publish('INITIAL_SESSION', null, new AuthRetryableFetchError('session renewal timed out', 0))
  }, 15000)
  void auth.getSession().then(({ data, error }) => {
    clearTimeout(deadline)
    if (alive && revision === initial) publish('INITIAL_SESSION', error ? null : data.session, error)
  }, error => { clearTimeout(deadline); if (alive && revision === initial) publish('INITIAL_SESSION', null, error) })
  const { data } = auth.onAuthStateChange((event, session) => {
    if (!alive) return
    if (publish(event, session)) revision++
  })
  return () => { alive = false; clearTimeout(deadline); data.subscription.unsubscribe() }
}
