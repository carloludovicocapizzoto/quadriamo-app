import { describe, expect, it } from 'vitest'
import { streakOf, withDay } from './streak'

describe('slancio', () => {
  it('conta i giorni di fila fino a oggi', () => {
    const s = streakOf(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-12')
    expect(s).toMatchObject({ count: 3, doneToday: true, atRisk: false, best: 3 })
    expect(s.week).toEqual([false, false, false, false, true, true, true])
  })
  it('resta vivo fino a fine giornata, ma è a rischio', () => {
    expect(streakOf(['2026-10-10', '2026-10-11'], '2026-10-12')).toMatchObject({ count: 2, doneToday: false, atRisk: true })
  })
  it('si azzera se salti un giorno, il record resta', () => {
    expect(streakOf(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'], '2026-10-07')).toMatchObject({ count: 0, best: 3, atRisk: false })
  })
  it('withDay non duplica e resta ordinato', () => {
    expect(withDay(['2026-10-12', '2026-10-10'].sort(), '2026-10-11')).toEqual(['2026-10-10', '2026-10-11', '2026-10-12'])
    expect(withDay(['2026-10-12'], '2026-10-12')).toEqual(['2026-10-12'])
  })
})

import { createInitial, reducer } from '../store/state'
describe('slancio nello store', () => {
  it('aggiungere o modificare un movimento segna il giorno da solo; cambiare le impostazioni no', () => {
    const data = createInitial('EUR', '2026-10-12')
    let s = reducer({ loaded: true, data }, { type: 'setSettings', settings: { ...data.settings, currency: 'USD' } })
    expect(s.data!.activity).toBeUndefined()
    const tx = { id: 'a', date: '2026-10-12', description: 'Pizza', category: 'eatingOut', amount: 12 }
    s = reducer(s, { type: 'addTx', tx, at: '2026-10-12T10:00:00' })
    s = reducer(s, { type: 'updateTx', tx: { ...tx, amount: 14 }, at: '2026-10-12T18:00:00' })
    expect(s.data!.activity).toEqual(['2026-10-12'])
  })
})
