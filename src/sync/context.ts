import { createContext, useContext } from 'react'

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'

export interface SyncApi {
  enabled: boolean                       // false se l'app non è collegata a Supabase
  ready: boolean                         // la sessione salvata è stata letta (si sa se hai fatto l'accesso)
  user: { id: string; email: string; firstName: string } | null
  recovery: boolean                      // aperto dal link "password dimenticata": va scelta una nuova password
  status: SyncStatus
  lastSync: string | null                // ISO
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  /** true se serve confermare l'email prima di accedere */
  signUp: (p: { firstName: string; lastName: string; email: string; password: string }) => Promise<{ needsConfirm: boolean }>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
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
