import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'

/** Un risultato iniziale tardivo non può prevalere su un evento auth più recente. */
export function observeSession(auth: SupabaseClient['auth'], changed: (event: AuthChangeEvent, session: Session | null) => void) {
  let alive = true, revision = 0
  const initial = revision
  void auth.getSession().then(({ data, error }) => {
    if (alive && revision === initial) changed('INITIAL_SESSION', error ? null : data.session)
  }, () => { if (alive && revision === initial) changed('INITIAL_SESSION', null) })
  const { data } = auth.onAuthStateChange((event, session) => {
    if (!alive) return
    revision++
    changed(event, session)
  })
  return () => { alive = false; data.subscription.unsubscribe() }
}
