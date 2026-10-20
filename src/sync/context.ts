import { createContext, useContext } from 'react'
import type { AppData } from '../store/types'

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'reconciled' | 'error' | 'offline' | 'pending' | 'conflict' | 'upgrade' | 'paused'

export interface SyncApi {
  localSession: boolean
  enabled: boolean                       // false se l'app non è collegata a Supabase
  ready: boolean                         // la sessione salvata è stata letta (si sa se hai fatto l'accesso)
  user: { id: string; email: string; firstName: string; lastName: string; emailConfirmed: boolean } | null
  recovery: boolean                      // aperto dal link "password dimenticata": va scelta una nuova password
  inviteSetup: boolean                   // invito Alpha: scegliere una password prima di entrare
  status: SyncStatus
  lastSync: string | null                // ISO
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  /** true se serve confermare l'email prima di accedere */
  signUp: (p: { firstName: string; lastName: string; email: string; password: string; lang: string }) => Promise<{ needsConfirm: boolean }>
  /** codice di 6 cifre dell'email: conferma la registrazione o il recupero password restando nell'app */
  verifySignup: (email: string, code: string) => Promise<void>
  verifyRecovery: (email: string, code: string) => Promise<void>
  resendSignup: (email: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  /** cambio password dal Profilo: prima si verifica quella attuale (errore 'bad_current' se è sbagliata) */
  changePassword: (current: string, next: string) => Promise<void>
  updateNames: (firstName: string, lastName: string) => Promise<void>
  /** scollega tutte le altre sessioni (telefoni, computer) e tiene questa */
  signOutOthers: () => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  syncNow: () => Promise<void>
  startDemo: (data: AppData) => void
  endPreview: () => void
  isolatedPreview: boolean
}

export const SyncContext = createContext<SyncApi | null>(null)

export function useSync(): SyncApi {
  const v = useContext(SyncContext)
  if (!v) throw new Error('useSync outside SyncProvider')
  return v
}
