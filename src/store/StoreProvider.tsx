import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { note } from '../app/diagnostics'
import { StoreContext } from './context'
import { legacyCopies, readLegacyValues, recoverLegacy, requestPersistence } from './persist'
import { accountStore } from './accountStore'
import type { ScopeLease } from './scope'
import type { Action, AppData } from './state'
import { useI18n } from '../i18n/core'
import { downloadFile } from '../ui/kit/download'

export function StoreProvider({ children, lease, seed, onRecovery, onExit, preview }: {
  children: ReactNode; lease: ScopeLease; seed?: AppData
  onRecovery: (id: string, data: AppData) => void; onExit: () => void; preview: boolean
}) {
  const storage = accountStore(lease.scope, seed)
  const snapshot = useSyncExternalStore(storage.subscribe, storage.getSnapshot)
  const { t } = useI18n()
  const [copies, setCopies] = useState<Awaited<ReturnType<typeof legacyCopies>>>([])
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryError, setRecoveryError] = useState(false)
  const dispatch = useCallback((a: Action) => {
    if (!lease.current()) return
    note('action', a.type)
    storage.dispatch(a)
  }, [lease, storage])

  useEffect(() => {
    const unwatch = storage.watch()
    void requestPersistence()
    void storage.ready.then(async () => {
      const saved = await legacyCopies()
      if (lease.current()) setCopies(saved)
    }).catch(() => undefined)
    return unwatch
  }, [storage, lease])

  const exportUnsaved = () => {
    if (lease.current()) downloadFile('quadriamo-recovery', 'json', JSON.stringify(snapshot.state.data, null, 2), 'application/json')
  }
  const openLegacy = async (id: string) => {
    const data = await recoverLegacy(id)
    if (lease.current()) onRecovery(id, data)
  }
  const notice = <>
    {preview && <div className="demo-banner"><span>{t('storage.preview')}</span>
      <button className="btn small-btn" onClick={onExit}>{t('storage.return')}</button></div>}
    {snapshot.error && <section className="card" role="alert">
      <p>{t(snapshot.error === 'load' ? 'storage.loadError' : snapshot.error === 'conflict' ? 'storage.conflict' : 'storage.saveError')}</p>
      {snapshot.error !== 'conflict' && <button className="btn" onClick={() => void storage.retry().catch(() => undefined)}>{t('storage.retry')}</button>}
      {snapshot.state.data && <button className="btn" onClick={exportUnsaved}>{t('storage.export')}</button>}
      {!snapshot.state.loaded && <button className="btn" onClick={() => {
        void readLegacyValues().then(values => {
          if (lease.current()) downloadFile('quadriamo-legacy-original', 'json', JSON.stringify(values, null, 2), 'application/json')
        }).catch(() => { if (lease.current()) setRecoveryError(true) })
      }}>{t('storage.export')}</button>}
    </section>}
    {recoveryError && <p className="bad-text" role="alert">{t('storage.loadError')}</p>}
    {copies.length > 0 && <section className="card">
      <button className="link-btn" onClick={() => setShowRecovery(x => !x)}>{t('storage.legacy')}</button>
      {showRecovery && <><p>{t('storage.legacyHint')}</p>{copies.map(copy => <div className="stack-row" key={copy.id}>
        <span>{new Date(copy.savedAt).toLocaleDateString()}</span>
        <button className="btn" onClick={() => {
          if (lease.current()) downloadFile('quadriamo-legacy', 'json', JSON.stringify(copy, null, 2), 'application/json')
        }}>{t('storage.export')}</button>
        <button className="btn" onClick={() => void openLegacy(copy.id).catch(() => { if (lease.current()) setRecoveryError(true) })}>{t('storage.openLocal')}</button>
      </div>)}</>}
    </section>}
  </>
  if (!lease.current()) return null
  return <StoreContext.Provider value={{ state: snapshot.state, dispatch, storage, lease }}>
    {notice}
    {snapshot.state.loaded ? children : !snapshot.error ? <div className="gate" aria-busy="true">{t('app.loading')}</div> : null}
  </StoreContext.Provider>
}
