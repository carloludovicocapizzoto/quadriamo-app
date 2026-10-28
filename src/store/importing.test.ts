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
  it('compatibilità: le righe nella valuta di base hanno una chiave v2 distinta dalle impronte legacy', () => {
    const p = planImport(base().data!, [row(-52.3, 'EUR'), row(-52.3, null)])
    expect(p.items.map(i => i.fingerprint)).toEqual(['v2|2026-10-28|-52.30|qa bonifico', 'v2|2026-10-28|-52.30|qa bonifico|occurrence:2'])
  })
  it('un vecchio fingerprint estero resta un candidato, non viene scartato come duplicato certo', () => {
    const st = base()
    st.data!.importDone = { '2026-10-28|-5.00|qa bonifico': '2026-10-20T10:00:00Z' }
    expect(planImport(st.data!, [row(-5, 'USD')])).toMatchObject({ duplicates: 0, items: [{ legacyCandidate: true, currency: 'USD' }] })
  })
  it('una corrispondenza legacy resta visibile come possibile duplicato e la decisione esplicita rende idempotente il reimport', () => {
    let st = base()
    st.data!.importDone = { '2026-10-28|-5.00|qa bonifico': '2026-10-20T10:00:00Z' }
    const first = planImport(st.data!, [row(-5, 'USD')])
    expect(first).toMatchObject({ duplicates: 0, items: [{ amount: -5, currency: 'USD', legacyCandidate: true }] })
    st = reducer(st, { type: 'addInbox', items: first.items })
    st = reducer(st, { type: 'ignoreInbox', ids: [first.items[0].id], at: '2026-10-28T12:00:00Z' })
    expect(planImport(st.data!, [row(-5, 'USD')])).toMatchObject({ items: [], duplicates: 1 })
  })
  it.each(['EUR', 'JPY', 'KWD'])('una fingerprint moderna esatta in %s continua a essere idempotente', currency => {
    const r = row(currency === 'JPY' ? -1234 : currency === 'KWD' ? -1.234 : -12.34, currency)
    let st = base()
    const first = planImport(st.data!, [r])
    st = reducer(st, { type: 'addInbox', items: first.items })
    expect(planImport(st.data!, [r])).toMatchObject({ items: [], duplicates: 1 })
  })
  it('una legacy EUR ambigua richiede una sola decisione e non riappare al reimport', () => {
    let st = base()
    const old = '2026-10-28|-5.00|qa bonifico'
    st.data!.importDone = { [old]: '2026-10-20T10:00:00Z' }
    const first = planImport(st.data!, [row(-5)])
    expect(first).toMatchObject({ duplicates: 0, items: [{ legacyCandidate: true }] })
    st = reducer(st, { type: 'addInbox', items: first.items })
    expect(planImport(st.data!, [row(-5)])).toMatchObject({ items: [], duplicates: 1 })
  })
  it('una voce legacy già presente in inbox usa i suoi campi completi e non viene duplicata', () => {
    let st = base()
    st.data!.inbox = [{ id: 'old', fingerprint: '2026-10-28|-5.00|qa bonifico', date: '2026-10-28', description: 'QA Bonifico', amount: -5,
      currency: 'USD', category: null, paidFrom: null, source: 'csv' }]
    expect(planImport(st.data!, [row(-5, 'USD')])).toMatchObject({ items: [], duplicates: 1 })
  })
})
