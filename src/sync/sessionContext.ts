import { createContext, useContext } from 'react'
import type { SyncApi } from './context'
import type { AppData } from '../store/types'
import type { ScopeLease } from '../store/scope'

export interface SessionApi extends Omit<SyncApi, 'status' | 'lastSync' | 'syncNow'> {
  transitioning: boolean
  lease: ScopeLease
  seed?: AppData
  openRecovery: (id: string, data: AppData) => void
}
export const SessionContext = createContext<SessionApi | null>(null)
export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw Error('useSession outside SessionProvider')
  return value
}
