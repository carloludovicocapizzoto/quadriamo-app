// Unione dei dati di due dispositivi (sincronizzazione): vince la modifica più recente, le eliminazioni non vengono annullate.
import { mergeGoals, type Transaction } from '../engine'
import { widenFirstMonth } from './model'
import type { AppData, InboxItem } from './types'

/**
 * Unisce i dati di due dispositivi: per ogni movimento vince la modifica più recente,
 * le eliminazioni più recenti della modifica vincono, per le impostazioni vince la versione più recente.
 */
export function mergeData(a: AppData, b: AppData): AppData {
  const deleted: Record<string, string> = { ...a.deleted }
  for (const [id, at] of Object.entries(b.deleted ?? {})) if (!deleted[id] || at > deleted[id]) deleted[id] = at

  const byId = new Map<string, Transaction>()
  for (const tx of [...a.transactions, ...b.transactions]) {
    const prev = byId.get(tx.id)
    if (!prev || (tx.updatedAt ?? '') > (prev.updatedAt ?? '')) byId.set(tx.id, tx)
  }
  const transactions = [...byId.values()].filter(tx => !(deleted[tx.id] && deleted[tx.id] >= (tx.updatedAt ?? '')))

  const newerSettings = (b.settingsUpdatedAt ?? '') > (a.settingsUpdatedAt ?? '')
  let settings = newerSettings ? b.settings : a.settings
  for (const tx of transactions) settings = widenFirstMonth(settings, tx)

  const importDone: Record<string, string> = { ...a.importDone }
  for (const [fp, at] of Object.entries(b.importDone ?? {})) if (!importDone[fp] || at > importDone[fp]) importDone[fp] = at
  const inboxById = new Map<string, InboxItem>()
  for (const i of [...(a.inbox ?? []), ...(b.inbox ?? [])]) if (!importDone[i.fingerprint]) inboxById.set(i.id, i)
  const inboxFp = new Set<string>()
  const inbox = [...inboxById.values()].filter(i => !inboxFp.has(i.fingerprint) && inboxFp.add(i.fingerprint))
  const payday: Record<string, string[]> = { ...b.payday, ...a.payday }
  const newerInv = (b.investmentsUpdatedAt ?? '') > (a.investmentsUpdatedAt ?? '')
  const investments = newerInv ? b.investments : (a.investments ?? b.investments)
  const activity = [...new Set([...(a.activity ?? []), ...(b.activity ?? [])])].sort().slice(-400)
  const newerProfile = (b.profileUpdatedAt ?? '') > (a.profileUpdatedAt ?? '')
  const profile = newerProfile ? b.profile : (a.profileUpdatedAt ? a.profile : (a.profile ?? b.profile))
  return {
    version: 1, settings, transactions, deleted,
    settingsUpdatedAt: newerSettings ? b.settingsUpdatedAt : a.settingsUpdatedAt,
    ...(investments ? { investments, investmentsUpdatedAt: newerInv ? b.investmentsUpdatedAt : a.investmentsUpdatedAt } : {}),
    inbox, importDone, payday,
    ...(activity.length ? { activity } : {}),
    ...(a.goals || b.goals ? { goals: mergeGoals(a.goals, b.goals) } : {}),
    ...(profile || a.profileUpdatedAt || b.profileUpdatedAt
      ? { profile, profileUpdatedAt: newerProfile ? b.profileUpdatedAt : a.profileUpdatedAt } : {}),
  }
}
