// Quando chiedere il permesso per le notifiche: mai al primo avvio, solo quando servono (il primo promemoria) e una volta sola.
// Prima una schermata che spiega a cosa servono (NotifyAsk.tsx); il popup del sistema arriva solo se l'utente lo vuole.
// Se dice "non ora" o il sistema le blocca, non si richiede più: si riattivano dal Profilo → Notifiche.
import { useSyncExternalStore } from 'react'
import { pushSupported } from '../../beta/push'
import { local } from '../../storage'

const ASKED = 'q.notifyAsked'
let open = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(f => f())

/** Propone le notifiche se non sono attive, non sono bloccate e non sono già state proposte. */
export function askNotifications() {
  if (!pushSupported() || Notification.permission !== 'default' || local.get(ASKED)) return
  open = true; emit()
}
export function closeAsk() { local.set(ASKED, '1'); open = false; emit() }
export const useAskOpen = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => open)
