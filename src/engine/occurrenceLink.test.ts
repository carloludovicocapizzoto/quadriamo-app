// Pagamento collegato alla sua scadenza (transaction.occurrence) fra periodi diversi: P1 della review indipendente della #19
// (30/10) e regressioni richieste. Una spesa fissa appartiene al periodo della sua scadenza, come quella automatica: il
// pagamento collegato la conferma con il suo importo vero, senza spostarla di mese e senza contarla due volte. Solo dati sintetici.
import { describe, expect, it } from 'vitest'
import { agenda, computeMonth, defaultSettings, linkedOccurrences, nextMonth, periodSummary, rowIssues, type CalEvent, type Settings, type Transaction, type YearMonth } from '.'

const affitto: CalEvent = { id: 'aff', kind: 'rent', title: 'Affitto', amount: 400, category: 'fixedCosts', date: '2026-01-30',
  repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true }
const s: Settings = { ...defaultSettings({ firstMonth: { year: 2026, month: 9 } }), events: [affitto] }
const oct = { year: 2026, month: 10 }, nov = { year: 2026, month: 11 }, dec = { year: 2026, month: 12 }, jan = { year: 2027, month: 1 }
const today = '2027-02-15'   // tutto è già scaduto: le volte automatiche contano
const salary = (ym: YearMonth): Transaction => ({ id: `s${ym.year}${ym.month}`, date: `${ym.year}-${String(ym.month).padStart(2, '0')}-01`,
  description: 'Stipendio', category: 'salary', amount: 1000 })
const base = [salary(oct), salary(nov), salary(dec), salary(jan)]
const pay = (date: string, due: string, amount = 400, id = 'p'): Transaction =>
  ({ id, date, description: 'Affitto', category: 'fixedCosts', amount, occurrence: { eventId: 'aff', date: due } })
const fixed = (txs: Transaction[], ym: YearMonth) => {
  const r = computeMonth(ym, txs, s, today)
  return Math.round(r.transactions.filter(t => t.category === 'fixedCosts').reduce((a, t) => a + (t.amountIn ?? 0), 0) * 100) / 100
}
const months = [oct, nov, dec, jan]
const total = (txs: Transaction[]) => Math.round(months.reduce((a, ym) => a + fixed(txs, ym), 0) * 100) / 100
const remaining = (txs: Transaction[], ym: YearMonth) => computeMonth(ym, txs, s, today).buckets.reduce((a, b) => a + b.remaining, 0)

describe('P1: il pagamento collegato spostato in un altro mese non fa sparire la scadenza', () => {
  it('scadenza 30 ottobre, pagamento portato al 2 novembre: ottobre conta l\'affitto, novembre non lo conta due volte', () => {
    const txs = [...base, pay('2026-11-02', '2026-10-30')]
    expect(fixed(txs, oct)).toBe(400)   // prima della correzione: 0, ottobre perdeva la spesa prevista
    expect(fixed(txs, nov)).toBe(400)   // la scadenza di novembre (30/11), una volta sola
    expect(total(txs)).toBe(1600)       // quattro scadenze, quattro affitti: nessuno perso, nessuno doppio
  })
})

describe('collegamento fra periodi: regressioni', () => {
  const none = total(base)
  it('senza pagamenti: quattro scadenze automatiche', () => expect(none).toBe(1600))
  it('scadenza e pagamento nello stesso giorno', () => {
    const txs = [...base, pay('2026-10-30', '2026-10-30', 410)]
    expect(fixed(txs, oct)).toBe(410)
    expect(total(txs)).toBe(1610)
  })
  it('pagamento anticipato nel mese precedente (31 ottobre per la scadenza del 30 novembre): conta a novembre', () => {
    const txs = [...base, pay('2026-10-31', '2026-11-30')]
    expect(fixed(txs, oct)).toBe(400)
    expect(fixed(txs, nov)).toBe(400)
    expect(total(txs)).toBe(1600)
  })
  it('pagamento posticipato nel mese successivo (5 dicembre per il 30 novembre): conta a novembre', () => {
    const txs = [...base, pay('2026-12-05', '2026-11-30')]
    expect([fixed(txs, nov), fixed(txs, dec)]).toEqual([400, 400])
    expect(total(txs)).toBe(1600)
  })
  it('attraversamento dicembre/gennaio, nei due sensi', () => {
    const late = [...base, pay('2027-01-03', '2026-12-30')], early = [...base, pay('2026-12-31', '2027-01-30')]
    expect([fixed(late, dec), fixed(late, jan), total(late)]).toEqual([400, 400, 1600])
    expect([fixed(early, dec), fixed(early, jan), total(early)]).toEqual([400, 400, 1600])
  })
  it('data cambiata più volte e poi tornata all\'originale: stessi conti ogni volta', () => {
    for (const date of ['2026-10-30', '2026-11-02', '2026-10-15', '2026-11-20', '2026-10-30']) {
      const txs = [...base, pay(date, '2026-10-30')]
      expect([fixed(txs, oct), fixed(txs, nov), total(txs)]).toEqual([400, 400, 1600])
    }
  })
  it('collegamento lontano più di un periodo (dato incoerente): ignorato, la scadenza resta e il movimento conta alla sua data', () => {
    const txs = [...base, pay('2027-01-10', '2026-10-30')]
    expect(fixed(txs, oct)).toBe(400)
    expect(fixed(txs, jan)).toBe(800)
    expect(linkedOccurrences(txs, s).size).toBe(0)
  })
  it('movimento scollegato: torna un pagamento normale alla sua data, la scadenza automatica torna', () => {
    const txs = [...base, { ...pay('2026-10-30', '2026-10-30'), occurrence: null }]
    expect(fixed(txs, oct)).toBe(800)
    expect(rowIssues(computeMonth(oct, txs, s, today).transactions.find(t => t.id === 'p')!, s)).toContain('recurringDuplicate')
  })
  it('movimento collegato eliminato: la scadenza automatica torna', () => {
    expect(fixed(base, oct)).toBe(400)
    expect(computeMonth(oct, base, s, today).transactions.filter(t => t.recurring)).toHaveLength(1)
  })
  it('due movimenti sulla stessa scadenza: contano entrambi (sono pagamenti veri), l\'automatica sparisce una volta, il secondo è segnalato', () => {
    const txs = [...base, pay('2026-10-30', '2026-10-30', 400, 'p1'), pay('2026-10-31', '2026-10-30', 400, 'p2')]
    const r = computeMonth(oct, txs, s, today)
    expect(fixed(txs, oct)).toBe(800)
    expect(r.transactions.filter(t => t.recurring)).toHaveLength(0)
    expect(rowIssues(r.transactions.find(t => t.id === 'p1')!, s, txs)).toEqual([])
    expect(rowIssues(r.transactions.find(t => t.id === 'p2')!, s, txs)).toContain('recurringDuplicate')
  })
  it('scadenze mensili consecutive pagate ognuna dal suo movimento', () => {
    const txs = [...base, pay('2026-10-30', '2026-10-30', 400, 'a'), pay('2026-12-01', '2026-11-30', 401, 'b'), pay('2026-12-29', '2026-12-30', 402, 'c')]
    expect([fixed(txs, oct), fixed(txs, nov), fixed(txs, dec), fixed(txs, jan)]).toEqual([400, 401, 402, 400])
  })
  it('importo cambiato dopo il collegamento: conta il nuovo importo, una volta', () => {
    expect(fixed([...base, pay('2026-11-02', '2026-10-30', 455)], oct)).toBe(455)
  })
  it('budget, residui e totali: la somma dei residui di fine periodo è quella di chi non paga collegato, a parità di importo', () => {
    const plain = remaining(base, jan), linked = remaining([...base, pay('2026-11-02', '2026-10-30')], jan)
    expect(Math.round(linked * 100)).toBe(Math.round(plain * 100))
  })
  it('salvataggio e ricarica: stessi conti dopo la serializzazione', () => {
    const txs = [...base, pay('2026-11-02', '2026-10-30')]
    const copy = JSON.parse(JSON.stringify(txs))
    expect(months.map(ym => fixed(copy, ym))).toEqual(months.map(ym => fixed(txs, ym)))
  })
  it('evento cancellato: il collegamento non vale, il movimento conta alla sua data', () => {
    const gone = { ...s, events: [] }
    const txs = [...base, pay('2026-11-02', '2026-10-30')]
    expect(computeMonth(nov, txs, gone, today).transactions.some(t => t.id === 'p')).toBe(true)
  })
})

describe('cache dei collegamenti: si aggiorna con ogni nuovo elenco di movimenti', () => {
  it('stesso elenco: stesso risultato; elenco nuovo (aggiunta, modifica, eliminazione): ricalcolato', () => {
    const a = [...base, pay('2026-10-30', '2026-10-30')]
    expect(linkedOccurrences(a, s).size).toBe(1)
    const b = a.map(t => t.id === 'p' ? { ...t, occurrence: null } : t)
    expect(linkedOccurrences(b, s).size).toBe(0)
    expect(linkedOccurrences(a.filter(t => t.id !== 'p'), s).size).toBe(0)
    expect(linkedOccurrences(a, { ...s, events: [] }).size).toBe(0)
    // i mesi si ricalcolano con l'elenco nuovo: scollegato, ottobre ha la scadenza automatica e il pagamento (con avviso)
    expect([fixed(a, oct), fixed(b, oct), fixed(b, nextMonth(oct))]).toEqual([400, 800, 400])
  })
})

describe('allocate: nessun valore creato o perso (verifica richiesta dalla review)', () => {
  it('3.000 casi casuali: la somma delle parti è l\'importo nelle unità minime di EUR, JPY e KWD, anche negativo e con pesi strani', async () => {
    const { allocate } = await import('.')
    let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const odd = [0, -1, NaN, Infinity, 1e-9]
    for (let i = 0; i < 3000; i++) {
      const digits = [2, 0, 3][i % 3], scale = 10 ** digits
      const units = Math.round((rnd() - 0.3) * 1e7)
      const weights = Array.from({ length: 1 + (i % 5) }, () => rnd() < 0.15 ? odd[Math.floor(rnd() * odd.length)] : rnd())
      const parts = allocate(units / scale, weights, digits)
      expect(parts.reduce((a, x) => a + Math.round(x * scale), 0)).toBe(units)
      expect(parts.every(x => Math.abs(x * scale - Math.round(x * scale)) < 1e-6)).toBe(true)
      // ricalcolare non cambia nulla
      expect(allocate(units / scale, weights, digits)).toEqual(parts)
    }
  })
})

describe('P1-01 (review 1f6c616): un collegamento vale solo per una spesa vera, convertibile e della stessa categoria', () => {
  const paidIn = (txs: Transaction[], set = s) => periodSummary(agenda(set.events, '2026-10-01', '2026-10-31', linkedOccurrences(txs, set)), today)
  const bad: [string, Partial<Transaction>][] = [
    ['importo nullo', { amount: null }], ['importo zero', { amount: 0 }], ['importo negativo', { amount: -400 }],
    ['importo non finito', { amount: Infinity }], ['importo NaN', { amount: NaN }],
    ['valuta senza cambio', { currency: 'XYZ' }], ['cambio salvato a zero', { currency: 'USD', fxRate: 0 }],
    ['cambio salvato negativo', { currency: 'USD', fxRate: -1 }], ['cambio salvato non numerico', { currency: 'USD', fxRate: NaN }],
    ['categoria diventata entrata', { category: 'salary' }], ['categoria di spesa diversa da quella della scadenza', { category: 'groceries' }],
  ]
  it.each(bad)('%s: la scadenza resta, non è pagata, il movimento resta alla sua data', (_, x) => {
    const p = { ...pay('2026-11-02', '2026-10-30'), ...x }
    const txs = [...base, p]
    expect(fixed(txs, oct)).toBe(400)                                         // la spesa automatica non sparisce
    expect(computeMonth(oct, txs, s, today).transactions.some(t => t.id === 'p')).toBe(false)
    expect(computeMonth(nov, txs, s, today).transactions.some(t => t.id === 'p')).toBe(true)   // alla sua data reale
    expect(paidIn(txs)).toMatchObject({ paid: 0 })                            // il calendario non la considera pagata
    expect(p.occurrence).toEqual({ eventId: 'aff', date: '2026-10-30' })    // i dati originali non cambiano
  })
  it('un\'entrata collegata (dati ripristinati e riclassificati) non viene spostata a ottobre', () => {
    const txs = [...base, { ...pay('2026-11-02', '2026-10-30'), category: 'salary', amount: 50 }]
    expect(computeMonth(oct, txs, s, today).income).toBe(1000)
    expect(computeMonth(nov, txs, s, today).income).toBe(1050)
  })
  it('avvisi conservati: l\'importo mancante e il cambio mancante restano segnalati', () => {
    const txs = [...base, { ...pay('2026-11-02', '2026-10-30'), amount: null }, { ...pay('2026-11-03', '2026-10-30', 400, 'q'), currency: 'XYZ' }]
    const r = computeMonth(nov, txs, s, today)
    expect(rowIssues(r.transactions.find(t => t.id === 'p')!, s, txs)).toContain('missingAmount')
    expect(rowIssues(r.transactions.find(t => t.id === 'q')!, s, txs)).toContain('missingFx')
  })
  it('valuta estera con cambio valido: il collegamento vale', () => {
    const usd = { ...s, fxRates: { USD: 0.9 } }
    const txs = [...base, { ...pay('2026-11-02', '2026-10-30', 440), currency: 'USD' }]
    expect(Math.round(computeMonth(oct, txs, usd, today).transactions.filter(t => t.category === 'fixedCosts').reduce((a, t) => a + (t.amountIn ?? 0), 0) * 100) / 100).toBe(396)
  })
  it('evento disattivato o cancellato: il collegamento non vale, il movimento resta alla sua data', () => {
    const txs = [...base, pay('2026-11-02', '2026-10-30')]
    for (const set of [{ ...s, events: [{ ...affitto, active: false }] }, { ...s, events: [] }]) {
      expect(computeMonth(nov, txs, set, today).transactions.some(t => t.id === 'p')).toBe(true)
      expect(linkedOccurrences(txs, set).size).toBe(0)
    }
  })
  it('evento modificato (importo cambiato): il collegamento resta valido', () => {
    const set = { ...s, events: [{ ...affitto, amount: 450 }] }
    expect(linkedOccurrences([...base, pay('2026-11-02', '2026-10-30')], set).size).toBe(1)
  })
  it('la data reale del movimento resta nella riga (ricerca, CSV, backup leggono i dati originali)', () => {
    const txs = [...base, pay('2026-11-02', '2026-10-30')]
    expect(computeMonth(oct, txs, s, today).transactions.find(t => t.id === 'p')?.date).toBe('2026-11-02')
  })
})

describe('P1-02 (review 1f6c616): nessun collegamento a una scadenza prima del primo mese', () => {
  const fromNov: Settings = { ...s, firstMonth: nov, buckets: s.buckets.map((b, i) => ({ ...b, startingBalance: i === 0 ? 1000 : 0 })) }
  const left = (txs: Transaction[], t = '2026-11-15') => Math.round(computeMonth(nov, txs, fromNov, t).buckets.reduce((a, b) => a + b.remaining, 0) * 100) / 100
  it('archivio da novembre, saldo 1.000 €, scadenza 30 ottobre, pagamento 2 novembre: il saldo scende a 600 €', () => {
    const txs = [pay('2026-11-02', '2026-10-30')]
    expect(left(txs)).toBe(600)
    expect(linkedOccurrences(txs, fromNov).size).toBe(0)
  })
  it('la scadenza di novembre si collega normalmente', () => {
    const txs = [pay('2026-11-30', '2026-11-30')]
    expect(linkedOccurrences(txs, fromNov).size).toBe(1)
    expect(left(txs, '2026-12-01')).toBe(600)
  })
})
