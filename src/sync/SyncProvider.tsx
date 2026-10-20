// Ogni montaggio appartiene a un solo scope; la sessione viene risolta dal provider esterno.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store/context'
import { SyncContext, type SyncApi, type SyncStatus } from './context'
import { useSession } from './sessionContext'
import { loadAvatar } from '../profile/avatar'
import { readRemote, writeRemote } from './remote'
import { scopedClient } from './scopedClient'
import { runSync } from './runSync'
import { useI18n } from '../i18n/core'
import { SyncRecovery } from './SyncRecovery'

type SyncFailureKey = 'cloud.documentTooLarge' | 'cloud.requestTooLarge' | 'cloud.documentInvalid' | 'cloud.operationRejected'

export function SyncProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const { lease } = session
  const { state, storage } = useStore()
  const { t } = useI18n()
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [failureCode, setFailureCode] = useState<SyncFailureKey | null>(null)
  const [remoteReady, setRemoteReady] = useState(lease.scope.kind !== 'account' || !!state.data)
  const running = useRef(false), again = useRef(false)
  const snapshot = storage?.getSnapshot()

  useEffect(() => { if (session.user) void loadAvatar(session.user.id).catch(() => undefined) }, [session.user])

  const syncNow = useCallback(async () => {
    if (!lease.current() || lease.scope.kind !== 'account' || !state.loaded || !storage) return
    if (!navigator.onLine) { setStatus('offline'); return }
    if (running.current) { again.current = true; return }
    running.current = true
    setFailureCode(null)
    setStatus('syncing')
    try {
      const sb = scopedClient(lease)
      if (!sb) return
      const completed = await runSync({
        lease, storage, read: () => readRemote(sb), write: pending => writeRemote(sb, pending),
      })
      if (lease.current()) {
        setRemoteReady(true); setStatus(completed)
        if (completed === 'ok') setLastSync(new Date().toISOString())
      }
    } catch (error) {
      if (lease.current()) {
        const message = (error as { code?: string; message?: string }).message ?? ''
        setFailureCode(/ALPHA_HTTP_BODY_TOO_LARGE/.test(message) ? 'cloud.requestTooLarge'
          : /QSYNC_DOCUMENT_TOO_LARGE/.test(message) ? 'cloud.documentTooLarge'
          : /QSYNC_DOCUMENT_INVALID|QSYNC_UNSUPPORTED_DOCUMENT/.test(message) ? 'cloud.documentInvalid'
            : /QSYNC_OPERATION_REUSED|QSYNC_OPERATION_ID_INVALID/.test(message) ? 'cloud.operationRejected' : null)
        setStatus(navigator.onLine ? 'error' : 'offline')
      }
    } finally {
      running.current = false
      if (again.current && lease.current()) { again.current = false; window.setTimeout(() => { if (lease.current()) void syncNow() }, 0) }
    }
  }, [lease, state.loaded, storage])

  useEffect(() => { void syncNow() }, [syncNow])
  useEffect(() => {
    const timer = window.setTimeout(() => { void syncNow() }, 1500)
    return () => clearTimeout(timer)
  }, [state.data, syncNow])
  useEffect(() => {
    const online = () => { void syncNow() }
    const visible = () => { if (document.visibilityState === 'visible') void syncNow() }
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visible)
    return () => { window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visible) }
  }, [syncNow])

  useEffect(() => {
    const cooldownUntil = snapshot?.cloud?.cooldownUntil
    if (!cooldownUntil) return
    const delay = Math.max(0, Date.parse(cooldownUntil) - Date.now() + 50)
    const timer = window.setTimeout(() => { if (lease.current()) void syncNow() }, delay)
    return () => clearTimeout(timer)
  }, [lease, snapshot?.cloud?.cooldownUntil, syncNow])

  const visibleStatus: SyncStatus = snapshot?.error ? 'error' : snapshot?.dirty ? 'pending'
    : snapshot?.cloud?.conflict ? 'conflict' : status === 'syncing' || status === 'error' || status === 'offline' ? status : snapshot?.cloud?.status === 'pending' ? 'pending' : status
  const activate = async () => {
    if (running.current || !lease.current()) return
    const sb = scopedClient(lease)
    if (!sb) return
    setStatus('syncing')
    try { await readRemote(sb, true); lease.assert(); await syncNow() } catch { if (lease.current()) setStatus('error') }
  }
  const api = useMemo<SyncApi>(() => ({ ...session, ready: session.ready && remoteReady, status: visibleStatus, lastSync, syncNow }),
    [session, remoteReady, visibleStatus, lastSync, syncNow])
  return <SyncContext.Provider value={api}>
    {lease.scope.kind === 'account' && storage && <SyncRecovery storage={storage} lease={lease} status={visibleStatus} retry={syncNow} activate={activate} failureCode={failureCode} />}
    {!remoteReady && (status === 'error' || status === 'offline')
      ? <div className="gate"><section className="card"><p role="alert">{t('storage.remoteWait')}</p>
          <button className="btn" onClick={() => void syncNow()}>{t('storage.retry')}</button>
          <button className="link-btn" onClick={() => void session.signOut().catch(() => undefined)}>{t('sec.signOut')}</button>
        </section></div>
      : children}
  </SyncContext.Provider>
}
