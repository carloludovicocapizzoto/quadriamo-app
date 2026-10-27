import { set } from 'idb-keyval'
import { DEFAULT_NOTIFY, type CalEvent, type NotifyPrefs } from '../engine'
import { currentScope, personalKey } from '../store/scope'

export const notifyPrefs = (p: NotifyPrefs | undefined): NotifyPrefs => ({ ...DEFAULT_NOTIFY, ...p })

/** Conserva solo uno snapshot proprietario. Il protocollo push senza owner rimane sospeso. */
export async function syncReminders(events: CalEvent[], _prefs: NotifyPrefs, currency: string, lang: string): Promise<void> {
  const lease = currentScope()
  if (lease.scope.kind !== 'account' && lease.scope.kind !== 'local') return
  const amounts = Object.fromEntries(events.filter(e => e.amount != null).map(e => [e.title, e.amount]))
  try { await set(personalKey('quadriamo.reminders', lease.scope), { lang, currency, amounts }) } catch { /* non disponibile */ }
}

export async function syncPushPrefs(_prefs: NotifyPrefs): Promise<void> {}
