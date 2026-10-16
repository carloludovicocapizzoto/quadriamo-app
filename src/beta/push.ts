// Notifiche push (promemoria per il feedback). Su iPhone funzionano solo con l'app installata sulla schermata Home.
import { supabase } from '../sync/client'
import { deviceId } from './device'
import { track } from './telemetry'
import { local } from '../storage'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () =>
  !!supabase && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

/** Chiede il permesso e iscrive il dispositivo. Restituisce false se l'utente rifiuta. */
export async function enablePush(lang: string): Promise<boolean> {
  if (!pushSupported()) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ??
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) as BufferSource })
  await register(sub, lang)
  void track('push_on')
  return true
}

async function register(sub: PushSubscription, lang: string) {
  const j = sub.toJSON()
  const { error } = await supabase!.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? '', p_auth: j.keys?.auth ?? '', p_device: deviceId(), p_lang: lang,
  })
  if (error) throw error
  // la notifica del mattino è sempre inclusa nelle notifiche; le notizie principali salvo che l'utente le abbia spente
  await supabase!.rpc('set_morning_push', { p_endpoint: sub.endpoint, p_on: true })
  await supabase!.rpc('set_news_push', { p_endpoint: sub.endpoint, p_on: newsWanted() })
}

const NEWS_PREF = 'q.newsPush'
export const newsWanted = () => local.get(NEWS_PREF) !== 'off'
/** Notizie principali sì/no per questo dispositivo. */
export async function setNewsPush(on: boolean) {
  local.set(NEWS_PREF, on ? 'on' : 'off')
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub && supabase) await supabase.rpc('set_news_push', { p_endpoint: sub.endpoint, p_on: on })
}

/** Dice al server che oggi l'utente ha aggiornato Quadriamo (solo la data: niente importi), così non riceve
 *  il promemoria "a sorpresa". Una volta al giorno per dispositivo. */
export async function touchPush(day: string): Promise<void> {
  try {
    if (local.get('q.touched') === day) return
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    const { error } = await supabase!.rpc('touch_push', { p_endpoint: sub.endpoint, p_day: day })
    if (!error) local.set('q.touched', day)
  } catch { /* offline: si riprova */ }
}

/** All'apertura: se le notifiche sono già attive, riallinea l'iscrizione sul server (anche quelle fatte prima che esistesse
 *  la notifica del mattino, o cancellate dal server). Non chiede mai il permesso. */
export async function syncPush(lang: string): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await register(sub, lang)
  } catch { /* offline: si riprova alla prossima apertura */ }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase?.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}
