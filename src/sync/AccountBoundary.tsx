import { useSyncExternalStore, type ReactNode } from 'react'
import { quarantinePersonalPush, usePushIsolation } from '../beta/push'
import { useI18n } from '../i18n/core'
import { StoreProvider } from '../store/StoreProvider'
import { cachedAccountStore } from '../store/accountStore'
import { downloadFile } from '../ui/kit/download'
import { Splash } from '../ui/Gate'
import { useSession } from './sessionContext'
import { SyncProvider } from './SyncProvider'

const noSnapshot = () => null
const noSubscription = () => () => {}
function IsolationGate({ retired }: { retired: boolean }) {
  const { lease } = useSession()
  const { t } = useI18n()
  const storage = cachedAccountStore(lease.scope)
  const snapshot = useSyncExternalStore(storage?.subscribe ?? noSubscription, storage?.getSnapshot ?? noSnapshot)
  return <section className="card" role="alert">
    <p>{t(retired ? 'storage.pushRetired' : 'storage.pushCleanupError')}</p>
    {snapshot?.dirty && snapshot.state.data && <>
      <p>{t('storage.saveError')}</p>
      <button className="btn" onClick={() => {
        if (lease.current()) downloadFile('quadriamo-recovery', 'json', JSON.stringify(snapshot.state.data, null, 2), 'application/json')
      }}>{t('storage.export')}</button>
    </>}
    {!retired && <button className="btn" onClick={() => void quarantinePersonalPush().catch(() => undefined)}>{t('storage.retry')}</button>}
  </section>
}

export function AccountBoundary({ children }: { children: ReactNode }) {
  const session = useSession()
  const push = usePushIsolation()
  if (push === 'error' || push === 'retired') return <IsolationGate retired={push === 'retired'} />
  if (!session.ready || session.transitioning || push === 'checking') return <Splash />
  return <StoreProvider key={session.lease.id} lease={session.lease} seed={session.seed}
    preview={session.isolatedPreview} onRecovery={session.openRecovery} onExit={session.endPreview}>
    <SyncProvider>{children}</SyncProvider>
  </StoreProvider>
}
