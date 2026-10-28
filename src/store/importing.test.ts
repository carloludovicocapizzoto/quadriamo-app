import { describe, expect, it } from 'vitest'
import { createInitial, planImport, reducer, type State } from './state'

// Regressioni Fase 2E sull'impronta dei doppioni: precisione della valuta, valuta nell'impronta, movimenti già importati.
const base = (currency = 'EUR'): State => ({ loaded: true, data: createInitial(currency, '2026-10-01') })
const row = (amount: number, currency: string | null = null, description = 'QA Bonifico') => ({ date: '2026-10-28', description, amount, currency })

describe('Fase 2E: doppioni con valute diverse e tre decimali', () => {
  it('due importi in KWD che differiscono al terzo decimale non sono lo stesso movimento', () => {
    let st = base()
    const first = planImport(st.data!, [row(-1.231, 'KWD')])
    expect(first.items).toHaveLength(1)
    st = reducer(st, { type: 'addInbox', items: first.items })
    const second = planImport(st.data!, [row(-1.234, 'KWD')])
    expect(second).toMatchObject({ duplicates: 0 })
    expect(second.items.map(i => i.amount)).toEqual([-1.234])
    // lo stesso estratto di nuovo resta idempotente
    expect(planImport(st.data!, [row(-1.231, 'KWD')])).toMatchObject({ items: [], duplicates: 1 })
  })
  it('con la valuta di base a tre decimali, l’impronta conserva il terzo decimale', () => {
    let st = base('KWD')
    st = reducer(st, { type: 'addInbox', items: planImport(st.data!, [row(-1.231)]).items })
    expect(planImport(st.data!, [row(-1.234)]).items).toHaveLength(1)
    expect(planImport(st.data!, [row(-1.231)])).toMatchObject({ items: [], duplicates: 1 })
  })
  it('lo stesso importo in due valute, nello stesso file, sono due movimenti', () => {
    const p = planImport(base().data!, [row(-5, null), row(-5, 'USD')])
    expect(p.items.map(i => i.currency)).toEqual([null, 'USD'])
    expect(p.duplicates).toBe(0)
  })
  it('lo stesso importo in un’altra valuta, in un import successivo, non è un doppione', () => {
    let st = base()
    st = reducer(st, { type: 'addInbox', items: planImport(st.data!, [row(-5, 'USD')]).items })
    expect(planImport(st.data!, [row(-5, 'GBP')]).items).toHaveLength(1)
  })
  it('compatibilità: le righe nella valuta di base hanno ancora l’impronta di prima', () => {
    const p = planImport(base().data!, [row(-52.3, 'EUR'), row(-52.3, null)])
    expect(p.items.map(i => i.fingerprint)).toEqual(['2026-10-28|-52.30|qa bonifico', '2026-10-28|-52.30|qa bonifico|occurrence:2'])
  })
  it('compatibilità: un movimento in valuta estera importato con la vecchia impronta non torna come nuovo', () => {
    const st = base()
    st.data!.importDone = { '2026-10-28|-5.00|qa bonifico': '2026-10-20T10:00:00Z' }
    expect(planImport(st.data!, [row(-5, 'USD')])).toMatchObject({ items: [], duplicates: 1 })
  })
})
