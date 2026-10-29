import { useSyncExternalStore } from 'react'
import { ENV } from '../env'
import { ISOLATION_WORKER } from '../pushProtocol'
import { personal } from '../storage'
import { onScopeChange } from '../store/scope'

// L'endpoint e i payload precedenti non hanno un binding verificabile con lo scope locale.
// Nessuna registrazione/RPC finché il protocollo non sarà aggiornato e provato separatamente.
export const PERSONAL_PUSH_PAUSED = true
export const pushSupported = () => false
export const pushEnabled = async (): Promise<boolean> => false
export const enablePush = async (_lang: string): Promise<boolean> => false

export type PushIsolation = 'checking' | 'safe' | 'retired' | 'error'
let isolation: PushIsolation = 'checking'
let running: Promise<void> | null = null
let retired = false
const listeners = new Set<() => void>()
const publish = (value: PushIsolation) => { isolation = value; listeners.forEach(f => f()) }
export const pushIsolationSnapshot = () => isolation
export const usePushIsolation = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, pushIsolationSnapshot)

/** Ritira localmente i worker precedenti, anche senza rete. Nessuna revoca usa il token di un altro account. */
export function quarantinePersonalPush(): Promise<void> {
  if (running) return running
  if (isolation === 'error') publish('checking')
  running = (async () => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) { publish('safe'); return }
    const scope = new URL(ENV.base, location.origin).href
    const safeWorker = new URL(ISOLATION_WORKER, scope).href
    const registrations = await navigator.serviceWorker.getRegistrations()
    let failed = false
    await Promise.all(registrations.filter(reg => reg.scope === scope).map(async reg => {
      const workers = [reg.active, reg.waiting, reg.installing].filter((worker): worker is ServiceWorker => !!worker)
      const unsafe = workers.some(worker => worker.scriptURL !== safeWorker)
      const missingApiSafe = ENV.name === 'alpha' && !unsafe
      try {
        // In the Alpha the recognized worker cannot display personal push and subscriptions stay paused.
        // Only the clean Alpha origin may tolerate missing APIs with no worker or its known-safe worker.
        // Historical production and legacy/unknown workers still fail closed.
        if (typeof reg.getNotifications === 'function') {
          const notifications = await reg.getNotifications()
          notifications.forEach(n => n.close())
        } else if (!missingApiSafe) failed = true
        const manager = reg.pushManager
        if (typeof manager?.getSubscription === 'function') {
          const sub = await manager.getSubscription()
          if (sub && (typeof sub.unsubscribe !== 'function' || !await sub.unsubscribe())) failed = true
        } else if (!missingApiSafe) failed = true
      } catch { failed = true }
      if (unsafe) {
        // Il vecchio script non può essere aggiornato offline. Rimuovere la registrazione interrompe i nuovi push.
        try { if (!await reg.unregister()) failed = true; else retired = true } catch { failed = true }
      }
    }))
    publish(failed ? 'error' : retired ? 'retired' : 'safe')
    if (failed) throw Error('push isolation not verified')
  })().catch(e => { publish('error'); throw e }).finally(() => { running = null })
  return running
}

onScopeChange(() => { publish('checking'); void quarantinePersonalPush().catch(() => undefined) })
export const syncPush = async (_lang: string) => { await quarantinePersonalPush().catch(() => undefined) }
export const disablePush = quarantinePersonalPush
export const touchPush = async (_day: string): Promise<void> => {}
export const newsWanted = () => personal.get('q.newsPush') !== 'off'
export async function setNewsPush(on: boolean) { personal.set('q.newsPush', on ? 'on' : 'off') }
