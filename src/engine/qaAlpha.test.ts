// Difetti della QA reale sull'Alpha (ef7ff9f, 29/10): P2-002 quote al centesimo, P2-003 «già pagato» solo se confermato,
// P3 niente «−0,00». Solo dati sintetici.
import { describe, expect, it } from 'vitest'
import { agenda, allocate, computeMonth, defaultSettings, nextMonth, paydayPlan, periodSummary, shownAmount, type CalEvent, type Settings, type Transaction } from '.'

const oct = { year: 2026, month: 10 }
const base = (x: Partial<Settings> = {}): Settings => ({ ...defaultSettings({ firstMonth: { year: 2026, month: 9 } }), ...x })
const tx = (id: string, date: string, category: string, amount: number, x: Partial<Transaction> = {}): Transaction =>
  ({ id, date, description: id, category, amount, ...x })
const cents = (n: number, digits = 2) => Math.round(n * 10 ** digits)
const parts = (txs: Transaction[], s = base(), ym = oct) => computeMonth(ym, txs, s, '2026-10-20').buckets.map(b => b.fromIncome)
const total = (xs: number[], digits = 2) => xs.reduce((a, x) => a + cents(x, digits), 0)

describe('P2-002: le quattro quote conservano esattamente l\'entrata', () => {
  it('10,25 € con 55/20/15/10: 5,64 + 2,05 + 1,54 + 1,02 (prima 10,26)', () => {
    expect(parts([tx('a', '2026-10-01', 'salary', 10.25)])).toEqual([5.64, 2.05, 1.54, 1.02])
  })
  it('il caso della QA: 4.010,25 € in più entrate sommano a 4.010,25, non 4.010,26', () => {
    const p = parts([tx('a', '2026-10-01', 'salary', 4000), tx('b', '2026-10-05', 'extraIncome', 10.25)])
    expect(total(p)).toBe(401025)
  })
  it.each([0.01, 0.02, 0.03, 0.07, 1.01, 10.25, 99.99, 1234.57, 4010.25])('nessun centesimo creato o perso da %s', amount => {
    const p = parts([tx('a', '2026-10-01', 'salary', amount)])
    expect(total(p)).toBe(cents(amount))
    expect(p.every(x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6)).toBe(true)
  })
  it('regola dei resti maggiori, deterministica: a parità vince la parte che viene prima', () => {
    expect(allocate(0.01, [0.25, 0.25, 0.25, 0.25])).toEqual([0.01, 0, 0, 0])
    expect(allocate(0.03, [0.25, 0.25, 0.25, 0.25])).toEqual([0.01, 0.01, 0.01, 0])
    expect(allocate(10.25, [0.55, 0.2, 0.15, 0.1])).toEqual(allocate(10.25, [0.55, 0.2, 0.15, 0.1]))
  })
  it('importi negativi: stessa ripartizione col segno opposto', () => {
    expect(allocate(-10.25, [0.55, 0.2, 0.15, 0.1])).toEqual([-5.64, -2.05, -1.54, -1.02])
  })
  it('quote «a modo mio»: ogni entrata divisa al centesimo', () => {
    const p = parts([tx('a', '2026-10-01', 'salary', 10.01, { paidFrom: 'custom', split: { essentials: 1 / 3, qualityOfLife: 1 / 3, safetyFund: 1 / 3 } })])
    expect(total(p)).toBe(1001)
  })
  it('rimborso (entrata negativa) e affitto prima delle parti: il totale resta quello delle entrate meno l\'affitto', () => {
    const s = base({ events: [{ id: 'r', kind: 'rent', title: 'Affitto', amount: 400.01, category: 'rent', date: '2026-01-01', repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true }] })
    const p = parts([tx('a', '2026-10-01', 'salary', 1000.05), tx('b', '2026-10-03', 'salary', -0.02)], s)
    expect(total(p)).toBe(100005 - 2 - 40001)
  })
  it('modifica ed eliminazione: si ricalcola da capo, senza resti dell\'importo di prima', () => {
    const before = parts([tx('a', '2026-10-01', 'salary', 10.25)])
    const edited = parts([tx('a', '2026-10-01', 'salary', 10.26)])
    expect(total(before)).toBe(1025)
    expect(total(edited)).toBe(1026)
    expect(parts([])).toEqual([0, 0, 0, 0])
  })
  it('quote, budget e residui coerenti: Σ disponibile = riporto + entrate, Σ residuo = disponibile − speso', () => {
    const r = computeMonth(oct, [tx('a', '2026-10-01', 'salary', 4010.25), tx('f', '2026-10-02', 'groceries', 100.1)], base(), '2026-10-20')
    expect(total(r.buckets.map(b => b.available))).toBe(401025)
    expect(total(r.buckets.map(b => b.remaining))).toBe(401025 - 10010)
    expect(paydayPlan(r).map(p => p.amount)).toEqual(r.buckets.map(b => b.fromIncome).filter(x => x > 0))
  })
  it('valute con precisioni diverse: JPY all\'unità, KWD al millesimo', () => {
    const jpy = parts([tx('a', '2026-10-01', 'salary', 1001)], base({ currency: 'JPY' }))
    expect(jpy).toEqual([551, 200, 150, 100])
    const kwd = parts([tx('a', '2026-10-01', 'salary', 10.255)], base({ currency: 'KWD' }))
    expect(total(kwd, 3)).toBe(10255)
    expect(kwd.every(x => Math.abs(x * 1000 - Math.round(x * 1000)) < 1e-6)).toBe(true)
  })
  it('stabile dopo ricarica, backup e sincronizzazione: stessi dati serializzati, stesse quote', () => {
    const txs = [tx('a', '2026-10-01', 'salary', 4000), tx('b', '2026-10-05', 'extraIncome', 10.25)]
    const copy = JSON.parse(JSON.stringify({ txs, s: base() }))
    expect(parts(copy.txs, copy.s)).toEqual(parts(txs))
  })
})

describe('P2-002: niente scarto che si accumula nei mesi (verifica chiesta da Federico)', () => {
  // la stessa entrata ogni mese faceva cadere la parità sempre sulla stessa parte: 12 centesimi in 24 mesi con 10,25 €
  const months = (n: number, make: (m: number, d: (day: number) => string) => Transaction[]) => {
    const txs: Transaction[] = []; let ym = { year: 2024, month: 1 }
    for (let m = 0; m < n; m++) {
      const y = ym
      txs.push(...make(m, day => `${y.year}-${String(y.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)); ym = nextMonth(ym)
    }
    return txs
  }
  const s = defaultSettings({ firstMonth: { year: 2024, month: 1 } })
  const check = (txs: Transaction[], exact: (b: number, m: number) => number) => {
    let ym = { year: 2024, month: 1 }, worst = 0
    const cum = [0, 0, 0, 0]
    for (let m = 0; m < 24; m++) {
      const r = computeMonth(ym, txs, s, '2026-10-29')
      r.buckets.forEach((b, i) => { cum[i] += b.fromIncome; worst = Math.max(worst, Math.abs(cents(cum[i]) - exact(i, m))) })
      ym = nextMonth(ym)
    }
    return worst
  }
  it('10,25 € ogni mese per 24 mesi: ogni parte resta entro un centesimo dalla sua quota esatta', () => {
    const txs = months(24, (m, d) => [tx(`s${m}`, d(1), 'salary', 10.25)])
    expect(check(txs, (i, m) => 1025 * (m + 1) * s.buckets[i].share)).toBeLessThanOrEqual(1)
  })
  // regola e «a modo mio» sono due divisioni cumulate separate: ognuna resta entro un centesimo, insieme meno di due
  it('più entrate e quote personalizzate in 1/3, 24 mesi: meno di un centesimo per ciascuna divisione', () => {
    const third = { essentials: 1 / 3, qualityOfLife: 1 / 3, investments: 1 / 3 }
    const txs = months(24, (m, d) => [tx(`s${m}`, d(1), 'salary', 1543.37), tx(`c${m}`, d(10), 'extraIncome', 10, { paidFrom: 'custom', split: third })])
    const w = (i: number) => [1 / 3, 1 / 3, 0, 1 / 3][i]
    expect(check(txs, (i, m) => 154337 * (m + 1) * s.buckets[i].share + 1000 * (m + 1) * w(i))).toBeLessThan(2)
  })
})

describe('P2-002: pesi che non fanno 100% (vecchi backup, dati non validi)', () => {
  it('99,9% o 150%: si divide comunque tutto l\'importo, in proporzione', () => {
    expect(total(allocate(100, [0.549, 0.2, 0.15, 0.1]))).toBe(10000)
    expect(total(allocate(100, [0.75, 0.3, 0.3, 0.15]))).toBe(10000)
    expect(allocate(100, [0.75, 0.3, 0.3, 0.15])).toEqual([50, 20, 20, 10])
  })
  it('pesi nulli, negativi o non numerici: tutto alla prima parte, niente che sparisce', () => {
    expect(allocate(10.25, [0, 0, 0, 0])).toEqual([10.25, 0, 0, 0])
    expect(allocate(10.25, [NaN, -1, 0, 0])).toEqual([10.25, 0, 0, 0])
    expect(allocate(10, [NaN, 0.5, -1, 0.5])).toEqual([0, 5, 0, 5])
  })
  it('un\'entrata «a modo mio» con quote rotte in un vecchio backup: il totale delle parti è l\'entrata', () => {
    const p = parts([tx('a', '2026-10-01', 'salary', 10.01, { paidFrom: 'custom', split: { essentials: 0.4, qualityOfLife: 0.4 } })])
    expect(total(p)).toBe(1001)
  })
})

describe('P2-003: «già pagato» solo per quello che è stato confermato', () => {
  const ev = (x: Partial<CalEvent>): CalEvent => ({ id: 'e', kind: 'loan', title: 'Rata', amount: 84.99, category: 'loans', date: '2026-10-29',
    repeat: { every: 1, unit: 'month' }, until: null, done: [], active: true, ...x })
  it('la rata che scade oggi, non segnata come fatta, non è pagata (era «Già pagato 100%»)', () => {
    const s = periodSummary(agenda([ev({})], '2026-10-01', '2026-10-31'), '2026-10-29')
    expect(s).toMatchObject({ out: 84.99, paid: 0, toPay: 84.99, toConfirm: 84.99 })
  })
  it('segnata come fatta: pagata', () => {
    const s = periodSummary(agenda([ev({ done: ['2026-10-29'] })], '2026-10-01', '2026-10-31'), '2026-10-29')
    expect(s).toMatchObject({ paid: 84.99, toPay: 0, toConfirm: 0 })
  })
  it('una rata futura resta una previsione, non da confermare', () => {
    const s = periodSummary(agenda([ev({ date: '2026-10-30' })], '2026-10-01', '2026-10-31'), '2026-10-29')
    expect(s).toMatchObject({ paid: 0, toPay: 84.99, toConfirm: 0 })
  })
  it('nel budget la riga dice se è prevista, impegnata o pagata (confermata nel calendario)', () => {
    const rows = (e: CalEvent, today: string) => computeMonth(oct, [tx('f', '2026-10-02', 'groceries', 1)], base({ events: [e] }), today).transactions.filter(t => t.recurring)
    expect(rows(ev({}), '2026-10-28')[0]).toMatchObject({ upcoming: true, confirmed: false })
    expect(rows(ev({}), '2026-10-29')[0]).toMatchObject({ upcoming: false, confirmed: false })
    expect(rows(ev({ done: ['2026-10-29'] }), '2026-10-29')[0]).toMatchObject({ upcoming: false, confirmed: true })
  })
  it('nel budget la spesa ricorrente conta una volta: futura è solo messa da parte, dal suo giorno è spesa (non due volte)', () => {
    const s = base({ events: [ev({})] })
    const before = computeMonth(oct, [tx('f', '2026-10-02', 'groceries', 1)], s, '2026-10-28')
    const due = computeMonth(oct, [tx('f', '2026-10-02', 'groceries', 1)], s, '2026-10-29')
    expect(before.spent).toBe(1)
    expect(before.transactions.filter(t => t.recurring && t.upcoming)).toHaveLength(1)
    expect(due.spent).toBeCloseTo(85.99)
    expect(due.transactions.filter(t => t.recurring)).toHaveLength(1)
  })
})

describe('P3: zero è zero', () => {
  it.each([[-0.001, 'EUR', 0], [-0, 'EUR', 0], [0.004, 'EUR', 0], [-0.4, 'JPY', 0], [-0.0004, 'KWD', 0]] as const)('%s %s diventa 0, senza segno', (n, cur, out) => {
    expect(Object.is(shownAmount(n, cur), out)).toBe(true)
  })
  it.each([[-0.01, 'EUR', -0.01], [-0.005, 'EUR', -0.01], [0.005, 'EUR', 0.01], [-1, 'JPY', -1], [-0.001, 'KWD', -0.001]] as const)('un importo vero %s %s resta', (n, cur, out) => {
    expect(shownAmount(n, cur)).toBe(out)
  })
  it('formattato: «0,00 €», mai «−0,00 €»', () => {
    const f = (n: number) => new Intl.NumberFormat('it', { style: 'currency', currency: 'EUR' }).format(shownAmount(n, 'EUR'))
    expect(f(165 - 164.999999)).not.toMatch(/[-−]/)
    expect(f(-0.004)).toBe(f(0))
  })
})
