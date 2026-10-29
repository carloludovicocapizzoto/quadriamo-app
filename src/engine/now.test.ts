import { describe, expect, it } from 'vitest'
import type { CalEvent } from './calendar'
import { isActionable, nowItems } from './now'

const ev = (over: Partial<CalEvent>): CalEvent => ({
  id: 'e', kind: 'bill', title: 'Luce', amount: 40, category: 'fixedCosts', date: '2026-10-17',
  repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true, ...over,
})
const today = '2026-10-17'

describe('Adesso', () => {
  it('prima quello da fare, poi quello che arriva, poi le anomalie', () => {
    const items = nowItems({
      today, hour: 20, loggedToday: false, over: { amount: 35, planned: true },
      events: [
        ev({ id: 'luce', title: 'Luce', date: '2026-09-15', nag: true }),                                    // scaduta il 15 e da seguire
        ev({ id: 'affitto', kind: 'rent', title: 'Affitto', amount: 380, date: '2026-09-17' }),              // oggi
        ev({ id: 'netflix', kind: 'subscription', title: 'Netflix', amount: 17.99, date: '2026-09-19',
          prices: [{ date: '2026-10-11', from: 12.99, to: 17.99 }] }),                                       // dopodomani + aumento
        ev({ id: 'stip', kind: 'salary', title: 'Stipendio', amount: 1500, category: null, date: '2026-09-27' }),
        ev({ id: 'ci', kind: 'document', title: "Carta d'identità", amount: null, category: null, repeat: null, date: '2026-11-08' }),
        ev({ id: 'pat', kind: 'document', title: 'Patente', amount: null, category: null, repeat: null, date: '2026-10-10' }),
      ],
    })
    expect(items.map(x => x.type)).toEqual(['late', 'today', 'docExpired', 'over', 'nextOut', 'price', 'doc', 'nextIn', 'log'])
    expect(items[0]).toMatchObject({ type: 'late', date: '2026-10-15', days: 2 })
    expect(items.find(x => x.type === 'price')).toMatchObject({ pct: 38, yearly: 60 })
    expect(items.find(x => x.type === 'nextIn')).toMatchObject({ days: 10 })
    // da fare: la luce scaduta, la patente scaduta, segnare le spese; l'affitto di oggi si paga da solo
    expect(items.filter(isActionable).map(x => x.type)).toEqual(['late', 'docExpired', 'log'])
  })
  it('niente da segnalare: elenco vuoto; la sera senza spese segnate, solo il promemoria', () => {
    expect(nowItems({ today, hour: 10, loggedToday: false, events: [] })).toEqual([])
    expect(nowItems({ today, hour: 21, loggedToday: false, events: [] })).toEqual([{ type: 'log' }])
    expect(nowItems({ today, hour: 21, loggedToday: true, events: [] })).toEqual([])
  })
})
