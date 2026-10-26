// Autenticazione separata dal budget: l'identità cambia prima di aprire un archivio.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData } from '../store/types'
import { activateScope, currentScope, personalKey, scopeKey } from '../store/scope'
import { accountStore, cachedAccountStore, flushScope } from '../store/accountStore'
import { local } from '../storage'
import { ENV } from '../env'
import { supabase, AUTH_KEY, AUTH_NAMESPACE, ALPHA_INVITE_LINK, authRuntimeError, authRuntimeCurrent, isCurrentAuthSession, retryAuthRuntime, watchAuthRuntime } from './client'
import { scopedClient } from './scopedClient'
import { SessionContext, type SessionApi } from './sessionContext'
import type { SyncApi } from './context'
import { removeAvatar } from '../profile/avatar'
import { saveNames } from './profile'
import { scopeFor } from './scopeFor'
import { leaveScope } from './leaveScope'
import { authCommand, closeLocalSession } from './authCommand'
import { observeSession } from './observeSession'
import { cachedOfflineSession, storedAuthSession } from './offlineSession'
import { useI18n } from '../i18n/core'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { downloadFile } from '../ui/kit/download'

type User = SyncApi['user']
type AuthUser = { id: string; email?: string; email_confirmed_at?: string; user_metadata?: { first_name?: string; last_name?: string } }
const toUser = (u: AuthUser | null | undefined): User => u ? {
  id: u.id, email: u.email ?? '', firstName: u.user_metadata?.first_name ?? '', lastName: u.user_metadata?.last_name ?? '',
  emailConfirmed: !!u.email_confirmed_at,
} : null

export function SessionProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [user, setUser] = useState<User>(null)
  const [lease, setLease] = useState(currentScope)
  const [ready, setReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [inviteSetup, setInviteSetup] = useState(false)
  const [seed, setSeed] = useState<AppData>()
  const [localSession, setLocalSession] = useState(false), [localLogout, setLocalLogout] = useState(false)
  // la sessione è finita da sola (rinnovo rifiutato, uscita da un altro dispositivo): si dice perché si torna all'accesso
  const [sessionEnded, setSessionEnded] = useState(false), leaving = useRef(false), expected = useRef<string | null>(null)
  const [authFailed, setAuthFailed] = useState(false)
  const recoveryOwner = useRef<string | null>(null)
  const inviteArrival = useRef(ALPHA_INVITE_LINK)
  const authUser = useRef<User>(null)
  const installUser = useCallback((next: User) => {
    authUser.current = next
    const scope = scopeFor(next?.id ?? null)
    const current = currentScope()
    const lease = current.current() && scopeKey(current.scope) === scopeKey(scope) ? current : activateScope(scope)
    if (!next) recoveryOwner.current = null
    if (next) { setLocalLogout(false); setSessionEnded(false) }
    // anche all'avvio: c'era una sessione salvata (expected) ma il server non l'ha rinnovata
    else { if ((authUser.current || expected.current) && !leaving.current) setSessionEnded(true); leaving.current = false }
    expected.current = null
    if (inviteArrival.current && next) {
      local.set(personalKey('q.alphaInvitePending', scope), '1')
      inviteArrival.current = false
    }
    setInviteSetup(!!next && ENV.name === 'alpha' && local.get(personalKey('q.alphaInvitePending', scope)) === '1')
    setUser(next); setSeed(undefined); setLease(lease); setReady(true); setRecovery(!!next && recoveryOwner.current === next.id); setTransitioning(false)
  }, [])

  useEffect(() => {
    let alive = true
    if (!ENV.supabase) {
      void Promise.resolve().then(() => { if (alive) installUser(null) })
      return () => { alive = false }
    }
    let stop = () => {}, observed: typeof supabase | undefined
    const changed = () => {
      if (!alive) return
      let stored: ReturnType<typeof storedAuthSession>
      try { stored = storedAuthSession(AUTH_KEY, AUTH_NAMESPACE, ENV.supabase!.url) }
      catch { stop(); observed = undefined; setLocalSession(false); installUser(null); setAuthFailed(true); return }
      // Una mutazione dello storage precede l'evento SDK: revoca subito il vecchio scope.
      if (stored?.user.id !== authUser.current?.id) {
        stop(); observed = undefined
        if (!stored) { setLocalSession(false); installUser(null) }
        else { expected.current = stored.user.id; setLease(activateScope(scopeFor(null))); setUser(null); setReady(false); setTransitioning(true) }
      }
      if (authRuntimeError) { stop(); observed = undefined; setAuthFailed(true); return }
      if (!authRuntimeCurrent() || !supabase || observed === supabase) return
      stop(); observed = supabase; setAuthFailed(false)
      stop = observeSession(observed.auth, (event, session) => {
      const next = toUser(session?.user)
      setLocalSession(!!session && session.expires_at! * 1000 <= Date.now())
      if (event === 'PASSWORD_RECOVERY' && next) { recoveryOwner.current = next.id; setRecovery(true) }
      if ((event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && next && next.id === authUser.current?.id) {
        authUser.current = next
        setUser(next)
        return
      }
      installUser(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      }, { offline: error => cachedOfflineSession(AUTH_KEY, AUTH_NAMESPACE, ENV.supabase!.url, isAuthRetryableFetchError(error)), current: isCurrentAuthSession })
    }
    const unwatch = watchAuthRuntime(changed)
    changed()
    return () => { alive = false; stop(); unwatch() }
  }, [installUser])

  const depart = useCallback((action: (guard: typeof lease) => Promise<void>) => leaveScope(lease,
    () => accountStore(lease.scope).flush(), action, (guard, busy) => { setLease(guard); setTransitioning(busy) }), [lease])

  const appUrl = window.location.origin + ENV.base + 'app/?login=1'
  const confirmUrl = window.location.origin + ENV.base + 'app/?confirmed=1'
  const api = useMemo<SessionApi>(() => ({
    enabled: !!ENV.supabase, ready, transitioning, user: lease.scope.kind === 'account' ? user : null, recovery, inviteSetup, lease, seed, localSession,
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
      if (ENV.name === 'alpha') throw new Error('invite required')
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
      if (data.user && storedAuthSession(AUTH_KEY, AUTH_NAMESPACE, ENV.supabase!.url)?.user.id === data.user.id) {
        recoveryOwner.current = data.user.id; setRecovery(true)
      }
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
      recoveryOwner.current = null
      if (ENV.name === 'alpha' && user) {
        local.set(personalKey('q.alphaInvitePending', scopeFor(user.id)), null)
        setInviteSetup(false)
      }
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
      const { error } = await authCommand(lease, auth => auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl, shouldCreateUser: ENV.name !== 'alpha' } }))
      if (error) throw error
    },
    verifyCode: async (email, code) => {
      lease.assert()
      const { error } = await authCommand(lease, auth => auth.verifyOtp({ email, token: code, type: 'email' }), true)
      if (error) throw error
    },
    signOut: () => depart(async guard => {
      leaving.current = true                                   // uscita voluta: resta finché l'uscita non è registrata
      try {
        if (!navigator.onLine || localSession) { await closeLocalSession(guard); setLocalLogout(true); return }
        const { error } = await authCommand(guard, auth => auth.signOut())
        if (error) throw error
      } catch (error) { leaving.current = false; throw error }
    }),
    deleteAccount: () => depart(async guard => {
      if (ENV.name === 'alpha') throw new Error('alpha account deletion requires assisted recovery review')
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
      leaving.current = true
      try { await authCommand(guard, auth => auth.signOut()) } catch (error) { leaving.current = false; throw error }
    }),
  }), [ready, user, recovery, inviteSetup, lease, seed, appUrl, confirmUrl, transitioning, depart, localSession])
  return <SessionContext.Provider value={api}>
    {authFailed ? <section className="card" role="alert"><p>{t('auth.localError')}</p>
      <button className="btn" onClick={() => void retryAuthRuntime().catch(() => setAuthFailed(true))}>{t('storage.retry')}</button>
      {lease.scope.kind === 'account' && cachedAccountStore(lease.scope)?.getSnapshot().state.data && <button className="btn" onClick={() => {
        const data = cachedAccountStore(lease.scope)?.getSnapshot().state.data
        if (lease.current() && data) downloadFile('quadriamo-recovery', 'json', JSON.stringify(data, null, 2), 'application/json')
      }}>{t('storage.export')}</button>}
      </section>
      : <>{localLogout && <p className="card" role="status">{t('auth.localLogout')}</p>}
        {sessionEnded && !localLogout && <p className="card" role="status">{t('auth.sessionEnded')}</p>}{children}</>}
  </SessionContext.Provider>
}
