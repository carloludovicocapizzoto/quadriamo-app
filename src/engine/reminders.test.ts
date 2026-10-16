import { describe, expect, it } from 'vitest'
import type { CalEvent } from './calendar'
import { DEFAULT_NOTIFY, allowed, planReminders, type NotifyPrefs } from './reminders'

const ev = (over: Partial<CalEvent>): CalEvent => ({
  id: 'a', kind: 'rent', title: 'Affitto', amount: 380, category: 'rent', date: '2026-11-01', repeat: { every: 1, unit: 'month' },
  until: null, done: [], active: true, reminders: [{ days: 1 }], ...over,
})
const p = (over: Partial<NotifyPrefs> = {}): NotifyPrefs => ({ ...DEFAULT_NOTIFY, ...over })

describe('promemoria', () => {
  it('N giorni prima all\'orario preferito, il giorno stesso, N ore prima dell\'orario dell\'evento', () => {
    const out = planReminders([ev({ reminders: [{ days: 3 }, { days: 0 }, { hours: 2 }], time: '18:00', repeat: null })], p(), '2026-10-20T10:00')
    expect(out.map(x => x.at)).toEqual(['2026-10-29T09:00', '2026-11-01T09:00', '2026-11-01T16:00'])
    expect(out[0]).toMatchObject({ date: '2026-11-01', titles: ['Affitto'], eventIds: ['a'] })
  })
  it('niente nelle ore di silenzio né nei giorni spenti: si sposta al primo momento libero', () => {
    expect(allowed('2026-10-20T23:30', p())).toBe('2026-10-21T08:00')
    expect(allowed('2026-10-21T06:00', p())).toBe('2026-10-21T08:00')
    // 24/10/2026 è un sabato: con il fine settimana spento si passa a lunedì
    expect(allowed('2026-10-24T09:00', p({ days: [1, 2, 3, 4, 5] }))).toBe('2026-10-26T08:00')
    expect(allowed('2026-10-20T09:00', p({ quiet: null }))).toBe('2026-10-20T09:00')
  })
  it('avvisi alla stessa ora diventano uno; oltre il tetto del giorno confluiscono nell\'ultimo', () => {
    const list = ['A', 'B', 'C', 'D'].map((t, i) => ev({ id: t, title: t, date: '2026-11-0' + (i + 1), reminders: [{ at: '2026-10-25T09:00' }], repeat: null }))
    const one = planReminders(list, p(), '2026-10-20T10:00')
    expect(one).toHaveLength(1)
    expect(one[0].titles).toEqual(['A', 'B', 'C', 'D'])
    const spread = ['A', 'B', 'C', 'D'].map((t, i) => ev({ id: t, title: t, reminders: [{ at: `2026-10-25T1${i}:00` }], repeat: null }))
    const capped = planReminders(spread, p({ maxPerDay: 2 }), '2026-10-20T10:00')
    expect(capped.map(x => x.titles)).toEqual([['A'], ['B', 'C', 'D']])
  })
  it('"finché non è fatto": ogni giorno dopo la scadenza, e si ferma quando è fatto', () => {
    const nag = ev({ repeat: null, reminders: [{ days: 0 }], nag: true })
    expect(planReminders([nag], p(), '2026-10-31T10:00').map(x => x.at.slice(0, 10)))
      .toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
    expect(planReminders([{ ...nag, done: ['2026-11-01'] }], p(), '2026-10-31T10:00')).toEqual([])
  })
  it('nessun promemoria se sono spenti, per il passato o per eventi disattivati', () => {
    expect(planReminders([ev({})], p({ reminders: false }), '2026-10-20T10:00')).toEqual([])
    expect(planReminders([ev({ active: false })], p(), '2026-10-20T10:00')).toEqual([])
    expect(planReminders([ev({ repeat: null, date: '2026-10-10' })], p(), '2026-10-20T10:00')).toEqual([])
  })
  it('un evento mensile ha un promemoria per ogni mese dentro l\'orizzonte', () => {
    expect(planReminders([ev({})], p(), '2026-10-20T10:00', 45).map(x => x.at)).toEqual(['2026-10-31T09:00', '2026-11-30T09:00'])
  })
})
