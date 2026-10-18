// Autenticazione separata dal budget: l'identità cambia prima di aprire un archivio.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData } from '../store/types'
import { activateScope, currentScope, personalKey, scopeKey } from '../store/scope'
import { accountStore, flushScope } from '../store/accountStore'
import { local } from '../storage'
import { ENV } from '../env'
import { supabase } from './client'
import { scopedClient } from './scopedClient'
import { SessionContext, type SessionApi } from './sessionContext'
import type { SyncApi } from './context'
import { removeAvatar } from '../profile/avatar'
import { saveNames } from './profile'
import { scopeFor } from './scopeFor'
import { leaveScope } from './leaveScope'
import { authCommand } from './authCommand'
import { observeSession } from './observeSession'

type User = SyncApi['user']
type AuthUser = { id: string; email?: string; email_confirmed_at?: string; user_metadata?: { first_name?: string; last_name?: string } }
const toUser = (u: AuthUser | null | undefined): User => u ? {
  id: u.id, email: u.email ?? '', firstName: u.user_metadata?.first_name ?? '', lastName: u.user_metadata?.last_name ?? '',
  emailConfirmed: !!u.email_confirmed_at,
} : null

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [lease, setLease] = useState(currentScope)
  const [ready, setReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [seed, setSeed] = useState<AppData>()
  const authUser = useRef<User>(null)
  const installUser = useCallback((next: User) => {
    authUser.current = next
    const scope = scopeFor(next?.id ?? null)
    const current = currentScope()
    const lease = current.current() && scopeKey(current.scope) === scopeKey(scope) ? current : activateScope(scope)
    setUser(next); setSeed(undefined); setLease(lease); setReady(true); setRecovery(false); setTransitioning(false)
  }, [])

  useEffect(() => {
    let alive = true
    if (!supabase) {
      void Promise.resolve().then(() => { if (alive) installUser(null) })
      return () => { alive = false }
    }
    return observeSession(supabase.auth, (event, session) => {
      const next = toUser(session?.user)
      if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && next?.id === authUser.current?.id) {
        authUser.current = next
        setUser(next)
        return
      }
      installUser(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
  }, [installUser])

  const depart = useCallback((action: (guard: typeof lease) => Promise<void>) => leaveScope(lease,
    () => accountStore(lease.scope).flush(), action, (guard, busy) => { setLease(guard); setTransitioning(busy) }), [lease])

  const appUrl = window.location.origin + ENV.base + 'app/?login=1'
  const confirmUrl = window.location.origin + ENV.base + 'app/?confirmed=1'
  const api = useMemo<SessionApi>(() => ({
    enabled: !!supabase, ready, transitioning, user: lease.scope.kind === 'account' ? user : null, recovery, lease, seed,
    isolatedPreview: lease.scope.kind === 'demo' || lease.scope.kind === 'recovery',
    startDemo: data => { void depart(async () => { setSeed(data); setLease(activateScope(scopeFor(user?.id ?? null, 'demo'))); setTransitioning(false) }).catch(() => undefined) },
    openRecovery: (id, data) => { void depart(async () => { setSeed(data); setLease(activateScope(scopeFor(id, 'recovery'))); setTransitioning(false) }).catch(() => undefined) },
    endPreview: () => { void depart(async () => { setSeed(undefined); setLease(activateScope(scopeFor(user?.id ?? null))); setTransitioning(false) }).catch(() => undefined) },
    signIn: async (email, password) => {
      await flushScope(lease)
      const { error } = await authCommand(lease, auth => auth.signInWithPassword({ email, password }), true)
      if (error) throw error
    },
    signUp: async ({ firstName, lastName, email, password, lang }) => {
      // lang: la lingua delle email (i modelli in supabase/templates la usano)
      await flushScope(lease)
      const { data, error } = await authCommand(lease, auth => auth.signUp({ email, password,
        options: { data: { first_name: firstName, last_name: lastName, lang }, emailRedirectTo: confirmUrl } }), true)
      if (error) throw error
      // con la conferma email attiva, un'email già registrata torna come utente senza identità
      if (data.user && !data.user.identities?.length) throw Object.assign(new Error('exists'), { code: 'user_already_exists' })
      if (data.user) local.set(personalKey('q.setupPending', scopeFor(data.user.id)), '1')
      return { needsConfirm: !data.session }
    },
    verifySignup: async (email, code) => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.verifyOtp({ email, token: code, type: 'signup' }), true)
      if (error) throw error
    },
    verifyRecovery: async (email, code) => {
      lease.assert()
      const { data, error } = await authCommand(lease, auth => auth.verifyOtp({ email, token: code, type: 'recovery' }), true)
      if (error) throw error
      if (data.user?.id === currentScope().scope.owner) setRecovery(true)
    },
    resendSignup: async email => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmUrl } }))
      if (error) throw error
    },
    resetPassword: async email => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.resetPasswordForEmail(email, { redirectTo: appUrl }))
      if (error) throw error
    },
    updatePassword: async password => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.updateUser({ password }))
      if (error) throw error
      lease.assert()
      setRecovery(false)
    },
    changePassword: async (current, next) => {
      lease.assert()
      const email = user?.email
      if (!email) throw new Error('no user')
      const check = await authCommand(lease, auth => auth.signInWithPassword({ email, password: current }))
      if (check.error) throw Object.assign(new Error('bad current'), { code: 'bad_current' })
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.updateUser({ password: next }))
      if (error) throw error
    },
    updateNames: async (firstName, lastName) => {
      lease.assert()
      if (!user) return
      const { data, error } = await authCommand(lease, auth => auth.updateUser({ data: { first_name: firstName, last_name: lastName } }))
      if (error) throw error
      lease.assert()
      await saveNames(user.id, { first_name: firstName || null, last_name: lastName || null }, lease)
      lease.assert()
      if (data.user) setUser(u => u && { ...u, firstName, lastName })
    },
    signOutOthers: async () => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.signOut({ scope: 'others' }))
      if (error) throw error
    },
    sendCode: async email => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl } }))
      if (error) throw error
    },
    verifyCode: async (email, code) => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.verifyOtp({ email, token: code, type: 'email' }), true)
      if (error) throw error
    },
    signOut: () => depart(async guard => {
      const { error } = await authCommand(guard, auth => auth.signOut())
      if (error) throw error
    }),
    deleteAccount: () => depart(async guard => {
      const sb = scopedClient(guard)
      if (!sb) throw Error('no account')
      if (user) await removeAvatar(user.id)
      guard.assert()
      const { error } = await sb.rpc('delete_my_account')
      if (error) throw error
      guard.assert()
      const store = accountStore(guard.scope)
      store.dispatch({ type: 'replace', data: null })
      await store.flush()
      guard.assert()
      await authCommand(guard, auth => auth.signOut())
    }),
  }), [ready, user, recovery, lease, seed, appUrl, confirmUrl, transitioning, depart])
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
}
