// Identità anonima del dispositivo e preferenze della beta (solo nel browser; niente dati del budget).
import { local } from '../storage'
const K = { device: 'quadriamo.device', stats: 'quadriamo.stats', firstUse: 'quadriamo.firstUse',
            feedbackAt: 'quadriamo.feedbackAt', lastOpen: 'quadriamo.lastOpen' } as const

export function deviceId(): string {
  let id = local.get(K.device)
  if (!id) { id = globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12); local.set(K.device, id) }
  return id
}

/** Consenso alle statistiche anonime: 'yes' | 'no' | null (non ancora chiesto). */
export const statsConsent = () => local.get(K.stats) as 'yes' | 'no' | null
export const setStatsConsent = (v: 'yes' | 'no') => local.set(K.stats, v)

export function platform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}
/** App installata: dalla Home/Dock, oppure l'app per computer (Mac/Windows) che si presenta come "QuadriamoDesktop". */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true ||
  /QuadriamoDesktop\//.test(navigator.userAgent) || 'quadriamoDesktop' in window

/** Il "ping" giornaliero parte una volta al giorno. */
export function firstOpenToday(today: string): boolean {
  if (local.get(K.lastOpen) === today) return false
  local.set(K.lastOpen, today)
  return true
}

/** Promemoria per il feedback: dopo 10 giorni dal primo uso, poi ogni 10 giorni dall'ultima richiesta. */
const FEEDBACK_EVERY_DAYS = 10
export function feedbackDue(now = Date.now()): boolean {
  const first = Number(local.get(K.firstUse) ?? 0)
  if (!first) { local.set(K.firstUse, String(now)); return false }
  const last = Number(local.get(K.feedbackAt) ?? 0) || first
  return now - last >= FEEDBACK_EVERY_DAYS * 864e5
}
export const markFeedbackAsked = (now = Date.now()) => local.set(K.feedbackAt, String(now))
