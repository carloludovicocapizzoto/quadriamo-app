// Gli eventi del calendario stanno nelle impostazioni (settings.events): qui le operazioni che li cambiano.
// Ogni modifica passa da setSettings, quindi si salva e si sincronizza come il resto delle impostazioni.
import type { CalEvent } from '../../engine'
import { useStore } from '../../store/context'
import { newId } from '../../store/state'

export function useEvents() {
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const set = (events: CalEvent[]) => dispatch({ type: 'setSettings', settings: { ...settings, events } })
  return {
    events: settings.events,
    save: (e: CalEvent) => set(settings.events.some(x => x.id === e.id) ? settings.events.map(x => x.id === e.id ? e : x) : [...settings.events, e]),
    remove: (id: string) => set(settings.events.filter(e => e.id !== id)),
    /** Segna (o toglie) come fatta una volta dell'evento. */
    toggleDone: (id: string, date: string) => set(settings.events.map(e => e.id !== id ? e
      : { ...e, done: e.done.includes(date) ? e.done.filter(d => d !== date) : [...e.done, date].sort().slice(-60) })),
  }
}

/** Un evento nuovo da compilare: di partenza una bolletta mensile da oggi. */
export function blankEvent(today: string, over: Partial<CalEvent> = {}): CalEvent {
  return { id: newId(), kind: 'bill', title: '', amount: null, category: 'fixedCosts', date: today, repeat: { every: 1, unit: 'month' },
    until: null, done: [], active: true, ...over }
}
