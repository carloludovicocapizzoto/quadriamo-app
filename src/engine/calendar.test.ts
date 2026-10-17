import { describe, expect, it } from 'vitest'
import { GOAL_EVENT, agenda, recentIncrease, timesPerYear, withPriceChange, yearlyCost, periodSummary, toneOf, budgetEvents, goalContributionId, goalEvents, nextOccurrence, occurrences, presetOf, remainingCount, untilAfterCount, type CalEvent } from './calendar'
import { defaultSettings } from './defaults'

const ev = (over: Partial<CalEvent>): CalEvent => ({
  id: 'e', kind: 'bill', title: 'Luce', amount: 40, category: 'fixedCosts', date: '2026-01-31',
  repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true, ...over,
})

describe('calendario: quando cade un evento', () => {
  it('ogni mese tiene il giorno, e il 31 diventa l\'ultimo giorno dei mesi corti', () => {
    expect(occurrences(ev({}), '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
    expect(occurrences(ev({ date: '2027-12-31', repeat: { every: 2, unit: 'month' } }), '2028-01-01', '2028-03-01')).toEqual(['2028-02-29'])
  })
  it('trimestrale, annuale, ogni due settimane, una volta', () => {
    expect(occurrences(ev({ date: '2026-01-15', repeat: { every: 3, unit: 'month' } }), '2026-01-01', '2026-12-31'))
      .toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15'])
    expect(occurrences(ev({ date: '2024-03-10', repeat: { every: 1, unit: 'year' } }), '2026-01-01', '2027-12-31')).toEqual(['2026-03-10', '2027-03-10'])
    expect(occurrences(ev({ date: '2026-10-02', repeat: { every: 2, unit: 'week' } }), '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-16', '2026-10-30'])
    expect(occurrences(ev({ date: '2026-10-20', repeat: null }), '2026-10-01', '2026-10-31')).toEqual(['2026-10-20'])
    expect(occurrences(ev({ date: '2026-09-20', repeat: null }), '2026-10-01', '2026-10-31')).toEqual([])
  })
  it('si ferma alla fine (ultima rata) e conta quante ne restano', () => {
    const rata = ev({ date: '2026-01-10', until: untilAfterCount({ date: '2026-01-10', repeat: { every: 1, unit: 'month' } }, 12) })
    expect(rata.until).toBe('2026-12-10')
    expect(occurrences(rata, '2026-11-01', '2027-03-01')).toEqual(['2026-11-10', '2026-12-10'])
    expect(remainingCount(rata, '2026-10-16')).toBe(2)   // il 10 ottobre è già passato
    expect(nextOccurrence(rata, '2026-12-11')).toBeNull()
    expect(remainingCount(ev({}), '2026-10-16')).toBeNull()
  })
  it('una ripetizione partita anni fa resta veloce e precisa', () => {
    // l'8 maggio 2001 era un martedì: ogni martedì
    expect(occurrences(ev({ date: '2001-05-08', repeat: { every: 1, unit: 'week' } }), '2026-10-01', '2026-10-15')).toEqual(['2026-10-06', '2026-10-13'])
  })
  it('riconosce le ripetizioni con un nome', () => {
    expect(presetOf(null)).toBe('once')
    expect(presetOf({ every: 3, unit: 'month' })).toBe('quarterly')
    expect(presetOf({ every: 10, unit: 'day' })).toBe('custom')
  })
})

describe('calendario: budget e agenda', () => {
  const s = { ...defaultSettings({ firstMonth: { year: 2026, month: 10 } }) }
  it('nel budget solo spese attive con importo e categoria di spesa', () => {
    s.events = [ev({ id: 'a' }), ev({ id: 'b', kind: 'salary', category: 'salary' }), ev({ id: 'c', amount: null }), ev({ id: 'd', active: false }),
      ev({ id: 'e', kind: 'reminder' }), ev({ id: 'f', category: 'salary' })]
    expect(budgetEvents(s).map(e => e.id)).toEqual(['a'])
  })
  it('l\'agenda mette in fila le volte di tutti gli eventi, con quelle già fatte', () => {
    const list = agenda([ev({ id: 'a', title: 'Luce', date: '2026-10-05', done: ['2026-10-05'] }), ev({ id: 'b', title: 'Affitto', date: '2026-10-01' })], '2026-10-01', '2026-10-31')
    expect(list.map(x => [x.date, x.event.title, x.done])).toEqual([['2026-10-01', 'Affitto', false], ['2026-10-05', 'Luce', true]])
  })
})

describe('scadenze degli obiettivi nel calendario', () => {
  const g = (id: string, deadline: string | null, saved: number, removed?: boolean) => ({ id, name: id, target: 100, deadline, icon: 'target',
    contributions: saved ? [{ id: 'c', date: '2026-01-01', amount: saved }] : [], createdAt: '2026-01-01', updatedAt: '', removed })
  it("l'ultimo giorno del mese scelto, solo per gli obiettivi aperti, con un promemoria una settimana prima", () => {
    const list = goalEvents([g('Viaggio', '2027-02', 20), g('Fatto', '2027-02', 100), g('Senza', null, 0), g('Via', '2027-02', 0, true)], '2026-10-17', n => `Scadenza: ${n}`)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: GOAL_EVENT + 'Viaggio', title: 'Scadenza: Viaggio', date: '2027-02-28', reminders: [{ days: 7 }] })
    expect(goalContributionId('e1', '2026-11-01')).toBe('ev-e1-2026-11-01')
  })
})

describe('riepilogo del mese nel calendario', () => {
  it('entrate, uscite, già pagato, da pagare (e in ritardo), giorni più pesanti', () => {
    const rent = ev({ id: 'r', kind: 'rent', title: 'Affitto', amount: 400, date: '2026-10-01', done: ['2026-10-01'] })
    const bill = ev({ id: 'b', kind: 'bill', title: 'Luce', amount: 60, date: '2026-10-10', nag: true })
    const gym = ev({ id: 'g', kind: 'payment', title: 'Palestra', amount: 30, date: '2026-10-12' })
    const pac = ev({ id: 'p', kind: 'pac', title: 'PAC', amount: 100, date: '2026-10-20' })
    const pay = ev({ id: 's', kind: 'salary', title: 'Stipendio', amount: 1500, date: '2026-10-27' })
    const note = ev({ id: 'n', kind: 'reminder', title: 'Disdire', amount: null, date: '2026-10-05' })
    const s = periodSummary(agenda([rent, bill, gym, pac, pay, note], '2026-10-01', '2026-10-31'), '2026-10-15')
    // la palestra è passata: pagata come nel budget; la luce va seguita finché non è fatta: in ritardo
    expect(s).toMatchObject({ income: 1500, out: 590, paid: 430, toPay: 160, overdue: 60, heavy: ['2026-10-01', '2026-10-20'] })
    expect(s.load['2026-10-10']).toBe(60)
    expect([rent, pac, pay, note].map(e => toneOf(e.kind))).toEqual(['out', 'save', 'in', 'note'])
  })
})

describe('abbonamenti: costo annuale e storico dei prezzi', () => {
  it('costo in un anno per ogni ripetizione', () => {
    expect(yearlyCost({ amount: 10, repeat: { every: 1, unit: 'month' } })).toBe(120)
    expect(yearlyCost({ amount: 60, repeat: { every: 1, unit: 'year' } })).toBe(60)
    expect(yearlyCost({ amount: 30, repeat: { every: 3, unit: 'month' } })).toBe(120)
    expect(timesPerYear(null)).toBe(0)
  })
  it('un cambio di prezzo finisce nello storico; lo stesso prezzo no', () => {
    const a = ev({ id: 'n', kind: 'subscription', title: 'Netflix', amount: 12.99 })
    const b = withPriceChange(a, { ...a, amount: 17.99 }, '2026-10-11')
    expect(b.prices).toEqual([{ date: '2026-10-11', from: 12.99, to: 17.99 }])
    expect(withPriceChange(b, { ...b, title: 'Netflix Standard' }, '2026-10-12').prices).toHaveLength(1)
    expect(recentIncrease(b, '2026-10-17')).toBe(38)
    expect(recentIncrease(b, '2027-11-01')).toBeNull()
  })
})
