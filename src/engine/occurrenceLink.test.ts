// Pagamento collegato alla sua scadenza (transaction.occurrence) fra periodi diversi: P1 della review indipendente della #19
// (30/10) e regressioni richieste. Una spesa fissa appartiene al periodo della sua scadenza, come quella automatica: il
// pagamento collegato la conferma con il suo importo vero, senza spostarla di mese e senza contarla due volte. Solo dati sintetici.
import { describe, expect, it } from 'vitest'
import { computeMonth, defaultSettings, linkedOccurrences, nextMonth, rowIssues, type CalEvent, type Settings, type Transaction, type YearMonth } from '.'

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
