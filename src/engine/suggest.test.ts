import { describe, expect, it } from 'vitest'
import type { CalEvent } from './calendar'
import { defaultSettings } from './defaults'
import { suggestEvents } from './suggest'
import type { Transaction } from './types'

const cats = defaultSettings({ firstMonth: { year: 2026, month: 4 } }).categories
let id = 0
const tx = (date: string, description: string, category: string, amount: number): Transaction => ({ id: String(++id), date, description, category, amount })
const monthly = (description: string, category: string, amount: number, day: number, months = [5, 6, 7, 8, 9, 10]) =>
  months.map(m => tx(`2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, description, category, amount))
const today = '2026-10-17'

describe('proposte di eventi dalle spese', () => {
  it('riconosce bolletta, stipendio e PAC che tornano ogni mese, con la prossima data', () => {
    const txs = [
      ...monthly('Enel Energia bolletta', 'fixedCosts', 62, 8),
      ...monthly('Stipendio ACME', 'salary', 1500, 27, [5, 6, 7, 8, 9]),
      ...monthly('Versamento PAC ETF', 'investmentsSaving', 100, 2, [8, 9, 10]),
      tx('2026-10-03', 'Supermercato', 'groceries', 40),
    ]
    const s = suggestEvents(txs, cats, [], today, [], 5)
    expect(s.map(x => [x.kind, x.date, x.amount])).toEqual([
      ['bill', '2026-11-08', 62], ['salary', '2026-10-27', 1500], ['pac', '2026-11-02', 100],
    ])
    expect(s[0]).toMatchObject({ title: 'Enel Energia bolletta', category: 'fixedCosts', count: 6 })
  })
  it('niente proposta se: meno di 3 mesi, importi troppo diversi, non più pagata, settimanale, già nel calendario o scartata', () => {
    const few = monthly('Netflix', 'fixedCosts', 13, 5, [9, 10])
    const varying = [tx('2026-07-10', 'Benzina Eni', 'transport', 20), tx('2026-08-10', 'Benzina Eni', 'transport', 70), tx('2026-09-10', 'Benzina Eni', 'transport', 35), tx('2026-10-10', 'Benzina Eni', 'transport', 90)]
    const stopped = monthly('Palestra Fit', 'fixedCosts', 35, 3, [4, 5, 6, 7])
    const weekly = Array.from({ length: 12 }, (_, i) => tx(`2026-${i < 6 ? '09' : '10'}-${String(1 + (i % 6) * 5).padStart(2, '0')}`, 'Mensa', 'eatingOut', 6))
    const drinks = [9, 10, 12, 11.5, 14, 10.5].map((a, i) => tx(`2026-${String(5 + i).padStart(2, '0')}-06`, 'Aperitivo', 'eatingOut', a))
    const gym = monthly('Palestra Fit', 'funShopping', 35, 4)
    expect(suggestEvents([...drinks, ...gym], cats, [], today).map(x => x.title)).toEqual(['Palestra Fit'])
    const twice = [...monthly('Lidl', 'groceries', 30, 3), ...monthly('Lidl', 'groceries', 30, 20)]
    expect(suggestEvents([...few, ...varying, ...stopped, ...weekly, ...twice], cats, [], today)).toEqual([])

    const rent = monthly('Affitto stanza', 'rent', 380, 1)
    const event: CalEvent = { id: 'e', kind: 'rent', title: 'Affitto', amount: 380, category: 'rent', date: '2026-05-01', repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true }
    expect(suggestEvents(rent, cats, [event], today)).toEqual([])
    const key = suggestEvents(rent, cats, [], today)[0].key
    expect(suggestEvents(rent, cats, [], today, [key])).toEqual([])
  })
})
