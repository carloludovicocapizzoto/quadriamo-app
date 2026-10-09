import { createContext, useContext } from 'react'

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'

export interface SyncApi {
  enabled: boolean                       // false se l'app non è collegata a Supabase
  user: { id: string; email: string } | null
  status: SyncStatus
  lastSync: string | null                // ISO
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  syncNow: () => Promise<void>
}

export const SyncContext = createContext<SyncApi | null>(null)

export function useSync(): SyncApi {
  const v = useContext(SyncContext)
  if (!v) throw new Error('useSync outside SyncProvider')
  return v
}
