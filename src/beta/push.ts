import { personal } from '../storage'
import { onScopeChange } from '../store/scope'

// L'endpoint e i payload precedenti non hanno un binding verificabile con lo scope locale.
// Nessuna registrazione/RPC finché il protocollo non sarà aggiornato e provato separatamente.
export const PERSONAL_PUSH_PAUSED = true
export const pushSupported = () => false
export const pushEnabled = async (): Promise<boolean> => false
export const enablePush = async (_lang: string): Promise<boolean> => false

/** Revoca locale: funziona anche offline, senza trasferire un endpoint fra account. */
export async function quarantinePersonalPush(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(async reg => {
    const notifications = await reg.getNotifications()
    notifications.forEach(n => n.close())
    const sub = await reg.pushManager?.getSubscription()
    if (sub && !await sub.unsubscribe()) throw Error('push subscription not retired')
    // L'aggiornamento del worker non richiede alcuna operazione sul database remoto.
    void reg.update().catch(() => undefined)
  }))
}

onScopeChange(() => { void quarantinePersonalPush().catch(() => undefined) })
export const syncPush = async (_lang: string) => { await quarantinePersonalPush().catch(() => undefined) }
export const disablePush = quarantinePersonalPush
export const touchPush = async (_day: string): Promise<void> => {}
export const newsWanted = () => personal.get('q.newsPush') !== 'off'
export async function setNewsPush(on: boolean) { personal.set('q.newsPush', on ? 'on' : 'off') }
