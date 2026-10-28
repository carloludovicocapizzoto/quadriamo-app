import { describe, expect, it } from 'vitest'
import { createInitial, mergeData, planImport, reducer, type State } from './state'

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
  it('compatibilità: un movimento in valuta estera importato con la vecchia impronta torna una volta sola, da verificare', () => {
    const st = base()
    st.data!.importDone = { '2026-10-28|-5.00|qa bonifico': '2026-10-20T10:00:00Z' }
    expect(planImport(st.data!, [row(-5, 'USD')]).items.map(i => i.maybeImported)).toEqual([true])
  })
})

// P1.2 (review Codex): una corrispondenza solo con l'impronta vecchia (due decimali, senza valuta) non prova che sia lo stesso
// movimento. La riga non si scarta: entra nella casella come «forse già importato», e decide l'utente.
describe('P1.2: corrispondenze solo con l’impronta vecchia', () => {
  const legacyDone = (st: State, ...keys: string[]) => { st.data!.importDone = Object.fromEntries(keys.map(k => [k, '2026-10-20T10:00:00Z'])); return st }
  const oldTx = (currency: string | null, amount = 5) =>
    ({ id: `old-${currency}`, date: '2026-10-28', description: 'QA Bonifico', category: 'other', amount, currency, updatedAt: '2026-10-20T10:00:00Z' })
  const decide = (st: State, type: 'confirmInbox' | 'ignoreInbox', i = 0) => {
    const item = st.data!.inbox![i]
    return type === 'ignoreInbox' ? reducer(st, { type, ids: [item.id], at: '2026-10-29T10:00:00Z' })
      : reducer(st, { type, ids: [item.id], at: '2026-10-29T10:00:00Z', txs: [{ id: `tx-${item.id}`, date: item.date, description: item.description, category: 'other', amount: Math.abs(item.amount), currency: item.currency }] })
  }

  it('vecchio movimento in USD, nuovo in GBP stesso giorno/descrizione/importo: la riga resta, da verificare', () => {
    const st = legacyDone(base(), '2026-10-28|-5.00|qa bonifico')
    st.data!.transactions = [oldTx('USD')]
    const p = planImport(st.data!, [row(-5, 'GBP')])
    expect(p.duplicates).toBe(0)
    expect(p.items).toHaveLength(1)
    expect(p.items[0]).toMatchObject({ currency: 'GBP', maybeImported: true })
  })
  it('vecchio movimento in USD (impronta vecchia), nuovo nella valuta di base: da verificare, con un’impronta che non si confonde', () => {
    const st = legacyDone(base(), '2026-10-28|-5.00|qa bonifico')
    st.data!.transactions = [oldTx('USD')]
    const p = planImport(st.data!, [row(-5, 'EUR')])
    expect(p.items).toHaveLength(1)
    expect(p.items[0].maybeImported).toBe(true)
    expect(p.items[0].fingerprint).not.toBe('2026-10-28|-5.00|qa bonifico')
  })
  it('compatibilità: un estratto nella valuta di base già importato con le impronte vecchie resta tutto «già importato»', () => {
    const st = legacyDone(base(), '2026-10-28|-5.00|qa bonifico', '2026-10-28|-5.00|qa bonifico|occurrence:2', '2026-10-29|1200.00|qa stipendio')
    const p = planImport(st.data!, [row(-5), row(-5, 'EUR'), { ...row(1200), date: '2026-10-29', description: 'QA Stipendio' }])
    expect(p).toMatchObject({ items: [], duplicates: 3 })
  })
  it('JPY: vecchie impronte riconosciute; lo stesso importo in un’altra valuta è da verificare, non scartato', () => {
    const st = legacyDone(base('JPY'), '2026-10-28|-500.00|qa bonifico')
    expect(planImport(st.data!, [row(-500)])).toMatchObject({ items: [], duplicates: 1 })
    const p = planImport(st.data!, [row(-500, 'EUR')])
    expect(p.items.map(i => i.maybeImported)).toEqual([true])
  })
  it('KWD a tre decimali con impronte vecchie: −1,231 e −1,234 restano entrambi visibili, da verificare', () => {
    const st = legacyDone(base('KWD'), '2026-10-28|-1.23|qa bonifico')
    const p = planImport(st.data!, [row(-1.231), { ...row(-1.234), date: '2026-10-28', description: 'QA Bonifico' }])
    expect(p.duplicates).toBe(0)
    expect(p.items.map(i => [i.amount, i.maybeImported])).toEqual([[-1.231, true], [-1.234, true]])
  })
  it('movimenti distinti con stessa data, descrizione e importo nello stesso file restano tutti', () => {
    const p = planImport(base().data!, [row(-5), row(-5), row(-5, 'USD'), row(-5, 'USD')])
    expect(p.items).toHaveLength(4)
    expect(new Set(p.items.map(i => i.fingerprint)).size).toBe(4)
  })
  it('file mensile e poi annuale sovrapposto: solo i movimenti nuovi', () => {
    let st = base()
    const month = [row(-5), row(-5, 'USD'), { ...row(-1.234, 'KWD'), description: 'QA Kuwait' }]
    st = reducer(st, { type: 'addInbox', items: planImport(st.data!, month).items })
    const year = [...month, { ...row(-7), date: '2026-11-02' }]
    const p = planImport(st.data!, year)
    expect(p.duplicates).toBe(3)
    expect(p.items.map(i => i.date)).toEqual(['2026-11-02'])
    expect(p.items[0].maybeImported).toBeUndefined()
  })
  it('casella con una vecchia riga USD (impronta vecchia): la stessa riga non torna; quella in EUR è nuova e non la sostituisce', () => {
    const st = base()
    st.data!.inbox = [{ id: 'old', fingerprint: '2026-10-28|-5.00|qa bonifico', date: '2026-10-28', description: 'QA Bonifico', amount: -5,
      currency: 'USD', category: null, paidFrom: null, source: 'csv' }]
    expect(planImport(st.data!, [row(-5, 'USD')])).toMatchObject({ items: [], duplicates: 1 })
    const p = planImport(st.data!, [row(-5, 'EUR')])
    expect(p.items).toHaveLength(1)
    expect(p.items[0].maybeImported).toBeUndefined()
    expect(p.items[0].fingerprint).not.toBe('2026-10-28|-5.00|qa bonifico')
    // dopo la sincronizzazione restano entrambe
    const next = reducer(st, { type: 'addInbox', items: p.items })
    expect(mergeData(st.data!, next.data!).inbox).toHaveLength(2)
  })
  it.each(['confirmInbox', 'ignoreInbox'] as const)('dopo la decisione (%s) i reimport successivi non la ripropongono, anche da un altro dispositivo', type => {
    let st = legacyDone(base(), '2026-10-28|-5.00|qa bonifico')
    st.data!.transactions = [oldTx('USD')]
    st = reducer(st, { type: 'addInbox', items: planImport(st.data!, [row(-5, 'GBP'), row(-5, 'EUR')]).items })
    expect(st.data!.inbox!.map(i => i.maybeImported)).toEqual([true, true])
    const other = structuredClone(st.data!)
    st = decide(decide(st, type), type)
    for (let i = 0; i < 2; i++) expect(planImport(st.data!, [row(-5, 'GBP'), row(-5, 'EUR')])).toMatchObject({ items: [], duplicates: 2 })
    const merged = mergeData(other, st.data!)
    expect(merged.inbox).toEqual([])
    expect(planImport(merged, [row(-5, 'GBP'), row(-5, 'EUR')])).toMatchObject({ items: [], duplicates: 2 })
  })
})
