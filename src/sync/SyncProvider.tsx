// Sincronizzazione con Supabase: all'accesso, poco dopo ogni modifica, al ritorno della connessione e
// quando l'app torna in primo piano. I dati locali e quelli online si uniscono con mergeData.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store/context'
import { mergeData, type AppData } from '../store/state'
import { supabase } from './client'
import { SyncContext, type SyncApi, type SyncStatus } from './context'
import { fetchRemote, pushRemote } from './remote'

const DEBOUNCE_MS = 1500

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore()
  const [user, setUser] = useState<SyncApi['user']>(null)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const dataRef = useRef<AppData | null>(state.data)
  const running = useRef(false)
  const again = useRef(false)
  const lastPushed = useRef('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { dataRef.current = state.data }, [state.data])

  // sessione
  useEffect(() => {
    if (!supabase) return
    const toUser = (u: { id: string; email?: string } | null | undefined) => (u ? { id: u.id, email: u.email ?? '' } : null)
    supabase.auth.getSession().then(({ data }) => setUser(toUser(data.session?.user)))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(toUser(session?.user)))
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

  const api = useMemo<SyncApi>(() => ({
    enabled: !!supabase, user, status, lastSync, syncNow,
    sendCode: async email => {
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
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
  }), [user, status, lastSync, syncNow])

  return <SyncContext.Provider value={api}>{children}</SyncContext.Provider>
}
