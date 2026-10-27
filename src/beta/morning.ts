// Snapshot proprietario: il worker non lo usa finché i push non hanno un binding verificabile.
import { set } from 'idb-keyval'
import { currentScope, personalKey } from '../store/scope'

export interface MorningSnapshot {
  lang: string; currency: string; end: string
  items: { name: string; free: number }[]
  updatedAt: string
  streak?: number; lastActive?: string
}

export async function saveMorningSnapshot(s: MorningSnapshot | null) {
  const lease = currentScope()
  if (lease.scope.kind !== 'account' && lease.scope.kind !== 'local') return
  try { await set(personalKey('quadriamo.morning', lease.scope), s) } catch { /* archivio accessorio non disponibile */ }
}
