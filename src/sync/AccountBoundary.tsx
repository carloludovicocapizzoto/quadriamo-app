import type { ReactNode } from 'react'
import { StoreProvider } from '../store/StoreProvider'
import { Splash } from '../ui/Gate'
import { useSession } from './sessionContext'
import { SyncProvider } from './SyncProvider'

export function AccountBoundary({ children }: { children: ReactNode }) {
  const session = useSession()
  if (!session.ready || session.transitioning) return <Splash />
  return <StoreProvider key={session.lease.id} lease={session.lease} seed={session.seed}
    preview={session.isolatedPreview} onRecovery={session.openRecovery} onExit={session.endPreview}>
    <SyncProvider>{children}</SyncProvider>
  </StoreProvider>
}
