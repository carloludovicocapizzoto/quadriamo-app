// Richiesta di feedback sulla Home: dal link della notifica (?feedback=1) o ogni 10 giorni. Da Profilo → Segnala un problema si apre come pagina.
import { useSyncExternalStore } from 'react'
import { feedbackDue } from '../beta/device'
import { onScopeChange } from '../store/scope'
import { ENTRY } from '../entry'

let open = ENTRY.get('feedback') === '1' || feedbackDue()
const listeners = new Set<() => void>()
const set = (v: boolean) => { open = v; listeners.forEach(f => f()) }
export const closeFeedback = () => set(false)
export const useFeedbackOpen = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => open)

onScopeChange(() => set(false))
