// Richiesta di feedback: dal link della notifica (?feedback=1), ogni 10 giorni, o da Profilo → Beta.
import { useSyncExternalStore } from 'react'
import { feedbackDue } from '../beta/device'
import { ENTRY } from '../entry'

let open = ENTRY.get('feedback') === '1' || feedbackDue()
const listeners = new Set<() => void>()
const set = (v: boolean) => { open = v; listeners.forEach(f => f()) }
export const openFeedback = () => set(true)
export const closeFeedback = () => set(false)
export const useFeedbackOpen = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => open)
