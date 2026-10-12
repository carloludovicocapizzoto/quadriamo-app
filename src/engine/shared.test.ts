import { describe, expect, it } from 'vitest'
import { balances, sharesFor, transfers, type SExpense, type SMember } from './shared'

const g: SMember = { user_id: 'g', display_name: 'Giulia', income: 2400, share: 70 }
const m: SMember = { user_id: 'm', display_name: 'Marco', income: 1600, share: 30 }
const e = (id: string, paid_by: string, amount: number, split: SExpense['split'] = null): SExpense =>
  ({ id, paid_by, date: '2026-10-10', description: id, amount, category: null, split })

describe('budget comune', () => {
  it('divide a metà, in proporzione alle entrate, con quote o tutto a chi paga', () => {
    expect(sharesFor(e('a', 'g', 100), [g, m], 'equal')).toEqual({ g: 0.5, m: 0.5 })
    expect(sharesFor(e('a', 'g', 100), [g, m], 'income')).toEqual({ g: 0.6, m: 0.4 })
    expect(sharesFor(e('a', 'g', 100), [g, m], 'custom')).toEqual({ g: 0.7, m: 0.3 })
    expect(sharesFor(e('a', 'g', 100, { mode: 'payer' }), [g, m], 'equal')).toEqual({ g: 1, m: 0 })
    expect(sharesFor(e('a', 'g', 100), [g, { ...m, income: null }], 'income')).toEqual({ g: 0.5, m: 0.5 })   // manca un'entrata: a metà
  })
  it('calcola i saldi e chi deve quanto a chi, tenendo conto dei saldi già fatti', () => {
    const ex = [e('spesa', 'g', 100), e('bollette', 'm', 40), e('regalo', 'g', 30, { mode: 'payer' })]
    const b = balances([g, m], ex, [], 'equal')
    expect(b).toEqual({ g: 30, m: -30 })          // Giulia ha anticipato 100, Marco 40: Marco deve 30
    expect(transfers(b)).toEqual([{ from: 'm', to: 'g', amount: 30 }])
    const after = balances([g, m], ex, [{ from_user: 'm', to_user: 'g', amount: 30 }], 'equal')
    expect(transfers(after)).toEqual([])
  })
  it('con più persone usa il minor numero di passaggi', () => {
    const c: SMember = { user_id: 'c', display_name: 'Chiara', income: 1000, share: 0 }
    const b = balances([g, m, c], [e('affitto', 'g', 900)], [], 'equal')
    expect(transfers(b)).toEqual([{ from: 'm', to: 'g', amount: 300 }, { from: 'c', to: 'g', amount: 300 }])
  })
})
