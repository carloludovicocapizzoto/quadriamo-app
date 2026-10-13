// Effetti di contorno dell'app, uno per hook: ognuno fa una cosa sola.
import { useEffect } from 'react'
import { safeToSpend, type MonthResult, type Streak } from '../engine'
import { ENTRY } from '../entry'
import { saveMorningSnapshot } from '../beta/morning'
import { syncPush, touchPush } from '../beta/push'
import { firstOpenToday, statsConsent } from '../beta/device'
import { track } from '../beta/telemetry'
import { refreshPlan } from '../billing/plan'
import type { AppData } from '../store/state'
import { bucketName } from '../ui/names'
import type { I18n } from '../i18n/core'
type T = I18n['t']
import { navigate } from './router'
import { toast } from './toast'

/** Avvio: vecchi indirizzi, pagina d'ingresso dai link (?join=, ?tab=news), indirizzo pulito, installazione. */
export function useBootstrap() {
  useEffect(() => {
    if (ENTRY.get('admin') === '1') { window.location.replace(`${import.meta.env.BASE_URL}admin/`); return }
    if (ENTRY.get('join')) navigate({ tab: 'profile', page: 'shared' }, { replace: true })
    else if (ENTRY.get('tab') === 'news') navigate({ tab: 'news' }, { replace: true })
    // i parametri servono una volta sola: si tolgono dall'indirizzo, la pagina (#/...) resta
    if (window.location.search) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash)
    const onInstalled = () => { void track('install') }
    window.addEventListener('appinstalled', onInstalled)
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])
}

/** Ritorno dalla pagina di pagamento: messaggio e piano riletto (la conferma arriva a Stripe e poi al server). */
export function useProReturn(t: T) {
  useEffect(() => {
    const pro = ENTRY.get('pro')
    if (!pro) return
    toast(t(pro === 'ok' ? 'pro.welcome' : 'pro.canceled'), 4000)
    if (pro === 'ok') { refreshPlan(); setTimeout(refreshPlan, 4000) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta all'avvio
  }, [])
}

/** Riepilogo per la notifica del mattino: resta sul dispositivo, il server non vede importi. */
export function useMorningSnapshot(data: AppData | null, month: MonthResult | null, streak: Streak | null, today: string, lang: string, t: T) {
  useEffect(() => {
    if (!data || !month || data.demo) { void saveMorningSnapshot(null); return }
    const items = safeToSpend(month, data.settings, today).map(x => ({
      name: bucketName(data.settings.buckets.find(b => b.id === x.bucketId)!, t), free: Math.max(0, x.free) }))
    void saveMorningSnapshot({ lang, currency: data.settings.currency, end: month.period.end, items, updatedAt: new Date().toISOString(),
      streak: streak?.count ?? 0, lastActive: data.activity?.at(-1) })
  }, [data, month, today, lang, t, streak])
}

/** Iscrizione alle notifiche riallineata all'apertura; "oggi ho aggiornato" al server (solo la data). */
export function usePushSync(lang: string, doneToday: boolean, today: string, demo: boolean) {
  useEffect(() => { void syncPush(lang) }, [lang])
  useEffect(() => { if (doneToday && !demo) void touchPush(today) }, [doneToday, today, demo])
}

/** Statistiche anonime (solo con consenso): una fotografia al giorno con soli conteggi. Restituisce l'invio manuale. */
export function useDailyPing(data: AppData | null, loaded: boolean, signedIn: boolean, today: string, lang: string) {
  const ping = (yes = statsConsent() === 'yes') => {
    if (!yes || !data || data.demo || !firstOpenToday(today)) return
    const months = new Set(data.transactions.map(x => x.date?.slice(0, 7)).filter(Boolean))
    void track('open', { txCount: data.transactions.length, monthsUsed: months.size, signedIn, lang })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta per caricamento dei dati
  useEffect(() => { if (loaded) ping() }, [loaded, !!data])
  return ping
}
