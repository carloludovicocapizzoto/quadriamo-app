// Gli eventi del calendario stanno nelle impostazioni (settings.events): qui le operazioni che li cambiano.
// Ogni modifica passa da setSettings, quindi si salva e si sincronizza come il resto delle impostazioni.
import { goalContributionId, todayIso, withPriceChange, type CalEvent } from '../../engine'
import { useStore } from '../../store/context'
import { newId } from '../../store/state'

export function useEvents() {
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const set = (events: CalEvent[]) => dispatch({ type: 'setSettings', settings: { ...settings, events } })
  return {
    events: settings.events,
    // un nuovo prezzo resta nello storico (Costo annuale, dettaglio dell'abbonamento)
    save: (e: CalEvent) => {
      const prev = settings.events.find(x => x.id === e.id)
      const next = withPriceChange(prev, e, todayIso())
      set(prev ? settings.events.map(x => x.id === e.id ? next : x) : [...settings.events, next])
    },
    remove: (id: string) => set(settings.events.filter(e => e.id !== id)),
    /** Segna (o toglie) come fatta una volta dell'evento. Un versamento verso un obiettivo aggiunge (o toglie) la cifra all'obiettivo. */
    toggleDone: (id: string, date: string) => {
      const ev = settings.events.find(e => e.id === id)
      if (!ev) return
      const doing = !ev.done.includes(date)
      set(settings.events.map(e => e.id !== id ? e : { ...e, done: doing ? [...e.done, date].sort().slice(-60) : e.done.filter(d => d !== date) }))
      const goal = ev.kind === 'saving' && ev.goalId ? state.data!.goals?.find(g => g.id === ev.goalId && !g.removed) : null
      if (goal && ev.amount) {
        const cid = goalContributionId(ev.id, date)
        const rest = goal.contributions.filter(c => c.id !== cid)
        dispatch({ type: 'saveGoal', goal: { ...goal, contributions: doing ? [...rest, { id: cid, date, amount: ev.amount }].sort((a, b) => a.date.localeCompare(b.date)) : rest } })
      }
    },
  }
}

/** Un evento nuovo da compilare: di partenza una bolletta mensile da oggi. */
export function blankEvent(today: string, over: Partial<CalEvent> = {}): CalEvent {
  // di partenza un promemoria il giorno prima: utile e discreto (si toglie o se ne aggiungono altri)
  return { id: newId(), kind: 'bill', title: '', amount: null, category: 'fixedCosts', date: today, repeat: { every: 1, unit: 'month' },
    until: null, done: [], active: true, reminders: [{ days: 1 }], ...over }
}
