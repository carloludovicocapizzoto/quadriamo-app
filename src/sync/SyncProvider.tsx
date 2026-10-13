// Sincronizzazione con Supabase: all'accesso, poco dopo ogni modifica, al ritorno della connessione e
// quando l'app torna in primo piano. I dati locali e quelli online si uniscono con mergeData.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store/context'
import { mergeData, type AppData } from '../store/state'
import { supabase } from './client'
import { SyncContext, type SyncApi, type SyncStatus } from './context'
import { saveNames } from './profile'
import { fetchRemote, pushRemote } from './remote'

const DEBOUNCE_MS = 1500

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore()
  const [user, setUser] = useState<SyncApi['user']>(null)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [ready, setReady] = useState(!supabase)
  const dataRef = useRef<AppData | null>(state.data)
  const running = useRef(false)
  const again = useRef(false)
  const lastPushed = useRef('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { dataRef.current = state.data }, [state.data])

  // sessione
  useEffect(() => {
    if (!supabase) return
    const toUser = (u: { id: string; email?: string; email_confirmed_at?: string; user_metadata?: { first_name?: string; last_name?: string } } | null | undefined) =>
      (u ? { id: u.id, email: u.email ?? '', firstName: u.user_metadata?.first_name ?? '', lastName: u.user_metadata?.last_name ?? '',
             emailConfirmed: !!u.email_confirmed_at } : null)
    supabase.auth.getSession().then(({ data }) => { setUser(toUser(data.session?.user)); setReady(true) }, () => setReady(true))
    const { data: sub } = supabase.auth.onAuthStateChange((e, session) => {
      setUser(toUser(session?.user))
      if (e === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const syncNow = useCallback(async () => {
    const sb = supabase
    if (!sb || !user || !state.loaded) return
    if (!navigator.onLine) { setStatus('offline'); return }
    if (running.current) { again.current = true; return }
    running.current = true
    setStatus('syncing')
    try {
      const remote = await fetchRemote(sb, user.id)
      const local = dataRef.current                         // letto dopo il download: include le ultime modifiche
      let merged: AppData | null
      if (!local || local.demo) merged = remote             // i dati di esempio non si caricano mai online
      else merged = remote ? mergeData(local, remote) : local
      if (merged) {
        if (JSON.stringify(merged) !== JSON.stringify(local)) dispatch({ type: 'replace', data: merged })
        const json = JSON.stringify(merged)
        if (json !== lastPushed.current && !(local?.demo && !remote)) {
          await pushRemote(sb, user.id, merged)
          lastPushed.current = json
        }
      }
      setLastSync(new Date().toISOString())
      setStatus('ok')
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline')
    } finally {
      running.current = false
      if (again.current) { again.current = false; window.setTimeout(() => { void syncNow() }, 0) }
    }
  }, [user, state.loaded, dispatch])

  // all'accesso e poco dopo ogni modifica dei dati
  useEffect(() => {
    if (!user || !state.loaded) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void syncNow() }, DEBOUNCE_MS)
    return () => clearTimeout(timer.current)
  }, [user, state.loaded, state.data, syncNow])

  // connessione tornata, app di nuovo in primo piano
  useEffect(() => {
    const onOnline = () => { void syncNow() }
    const onVisible = () => { if (document.visibilityState === 'visible') void syncNow() }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible) }
  }, [syncNow])

  const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}app/?login=1`
  // il pulsante dell'email apre il browser (non l'app installata): lì compare "Email confermata, torna sull'app"
  const confirmUrl = `${window.location.origin}${import.meta.env.BASE_URL}app/?confirmed=1`
  const api = useMemo<SyncApi>(() => ({
    enabled: !!supabase, ready, user, status, lastSync, syncNow, recovery,
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signUp: async ({ firstName, lastName, email, password, lang }) => {
      // lang: la lingua delle email (i modelli in supabase/templates la usano)
      const { data, error } = await supabase!.auth.signUp({ email, password,
        options: { data: { first_name: firstName, last_name: lastName, lang }, emailRedirectTo: confirmUrl } })
      if (error) throw error
      // con la conferma email attiva, un'email già registrata torna come utente senza identità
      if (data.user && !data.user.identities?.length) throw Object.assign(new Error('exists'), { code: 'user_already_exists' })
      return { needsConfirm: !data.session }
    },
    verifySignup: async (email, code) => {
      const { error } = await supabase!.auth.verifyOtp({ email, token: code, type: 'signup' })
      if (error) throw error
    },
    verifyRecovery: async (email, code) => {
      const { error } = await supabase!.auth.verifyOtp({ email, token: code, type: 'recovery' })
      if (error) throw error
      setRecovery(true)
    },
    resendSignup: async email => {
      const { error } = await supabase!.auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmUrl } })
      if (error) throw error
    },
    resetPassword: async email => {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: appUrl })
      if (error) throw error
    },
    updatePassword: async password => {
      const { error } = await supabase!.auth.updateUser({ password })
      if (error) throw error
      setRecovery(false)
    },
    changePassword: async (current, next) => {
      const email = user?.email
      if (!email) throw new Error('no user')
      const check = await supabase!.auth.signInWithPassword({ email, password: current })
      if (check.error) throw Object.assign(new Error('bad current'), { code: 'bad_current' })
      const { error } = await supabase!.auth.updateUser({ password: next })
      if (error) throw error
    },
    updateNames: async (firstName, lastName) => {
      if (!user) return
      const { data, error } = await supabase!.auth.updateUser({ data: { first_name: firstName, last_name: lastName } })
      if (error) throw error
      await saveNames(user.id, { first_name: firstName || null, last_name: lastName || null })
      if (data.user) setUser(u => u && { ...u, firstName, lastName })
    },
    signOutOthers: async () => {
      const { error } = await supabase!.auth.signOut({ scope: 'others' })
      if (error) throw error
    },
    sendCode: async email => {
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl } })
      if (error) throw error
    },
    verifyCode: async (email, code) => {
      const { error } = await supabase!.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) throw error
    },
    signOut: async () => {
      await supabase!.auth.signOut()
      lastPushed.current = ''
      setStatus('idle'); setLastSync(null)
    },
    deleteAccount: async () => {
      const { error } = await supabase!.rpc('delete_my_account')
      if (error) throw error
      await supabase!.auth.signOut()
      lastPushed.current = ''
      setStatus('idle'); setLastSync(null)
    },
  }), [ready, user, status, lastSync, syncNow, recovery, appUrl, confirmUrl])

  return <SyncContext.Provider value={api}>{children}</SyncContext.Provider>
}
