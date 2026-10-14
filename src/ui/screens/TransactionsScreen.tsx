import { useMemo, useState } from 'react'
import { activeFilters, daysBetween, nextMonth, prevMonth, filterTransactions, monthsBetween, periodStart, signedTotal, transactionsInMonths, undated, EMPTY_FILTER,
  type ClassifiedTx, type MonthResult, type Period, type TxFilter, type TxType, type YearMonth } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import type { AppData } from '../../store/state'
import { parseAmount } from '../../store/state'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { MonthNav } from '../MonthNav'
import { Swipe } from '../kit/Swipe'
import { BUCKET_COLORS, bucketName, categoryName } from '../names'
import { TransactionsView } from '../TransactionsView'
import { Empty } from '../kit/Empty'
import { TxRow } from '../TxRow'
import { AmountInput } from '../kit/AmountInput'
import { amountText } from '../kit/amount'

const PERIODS: Period[] = ['month', '3m', 'year', 'all']
const TYPES: TxType[] = ['expense', 'income', 'saving']

/** Movimenti: ricerca in cima, periodo e filtri; senza ricerca né filtri resta l'elenco del mese con i movimenti da confermare. */
export function TransactionsScreen({ data, current, result, today, onMonth, onOpen, embedded = false }: {
  embedded?: boolean; data: AppData; current: YearMonth; result: MonthResult; today: string; onMonth: (ym: YearMonth) => void; onOpen: (tx: ClassifiedTx) => void
}) {
  const { t, money, date } = useI18n()
  const s = data.settings
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>('month')
  const [f, setF] = useState<TxFilter>(EMPTY_FILTER)
  const [open, setOpen] = useState(false)
  const nFilters = activeFilters(f)
  // cercando, si cerca in tutti i mesi (a meno di aver scelto un periodo)
  const eff: Period = q.trim() && period === 'month' ? 'all' : period
  const searching = !!q.trim() || nFilters > 0 || period !== 'month'
  const names = useMemo(() => ({
    category: (id: string | null) => categoryName(s.categories.find(c => c.id === id), t),
    bucket: (id: string | null) => { const b = s.buckets.find(x => x.id === id); return b ? bucketName(b, t) : '' },
  }), [s, t])
  const pool = useMemo(() => searching ? transactionsInMonths(monthsBetween(periodStart(eff, current, s), current, s), data.transactions, s, today) : [],
    [searching, eff, current, s, data.transactions, today])
  const list = useMemo(() => filterTransactions(pool, { ...f, q }, names), [pool, f, q, names])

  const label = (d: string) => d === today ? t('day.today') : daysBetween(d, today) === 1 ? t('day.yesterday') : date(d, { weekday: 'short', day: 'numeric', month: 'long', year: d.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' })
  const groups = useMemo(() => {
    const out: { day: string; items: ClassifiedTx[] }[] = []
    for (const tx of list) { const g = out.at(-1); if (g && g.day === tx.date) g.items.push(tx); else out.push({ day: tx.date ?? '', items: [tx] }) }
    return out
  }, [list])
  const pills: { key: string; text: string; drop: () => void }[] = [
    ...f.types.map(x => ({ key: `t${x}`, text: t(`type.${x}` as keyof Dict), drop: () => setF({ ...f, types: f.types.filter(y => y !== x) }) })),
    ...f.buckets.map(x => ({ key: `b${x}`, text: names.bucket(x), drop: () => setF({ ...f, buckets: f.buckets.filter(y => y !== x) }) })),
    ...f.categories.map(x => ({ key: `c${x}`, text: names.category(x), drop: () => setF({ ...f, categories: f.categories.filter(y => y !== x) }) })),
    ...(f.min != null ? [{ key: 'min', text: `≥ ${money(f.min, s.currency)}`, drop: () => setF({ ...f, min: null }) }] : []),
    ...(f.max != null ? [{ key: 'max', text: `≤ ${money(f.max, s.currency)}`, drop: () => setF({ ...f, max: null }) }] : []),
  ]

  return (
    <div className={embedded ? '' : 'screen'}>
      {!embedded && <h1 className="screen-title">{t('nav.transactions')}</h1>}
      <div className="search">
        <Icon name="search" size={19} />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('srch.placeholder')} aria-label={t('srch.placeholder')} enterKeyHint="search" />
        {q && <button className="search-x" onClick={() => setQ('')} aria-label={t('srch.clearSearch')}><Icon name="close" size={16} /></button>}
      </div>
      <div className="filter-row">
        <button className={`fchip filter-btn${nFilters ? ' on' : ''}`} onClick={() => { tap(); setOpen(true) }}>
          <Icon name="filter" size={16} />{t('srch.filters')}{nFilters > 0 && <em>{nFilters}</em>}</button>
        {PERIODS.map(p => <button key={p} className={`fchip${eff === p ? ' on' : ''}`} onClick={() => { tap(); setPeriod(p) }}>{t(`per.${p}` as keyof Dict)}</button>)}
      </div>
      {pills.length > 0 && <div className="pill-row">
        {pills.map(p => <button key={p.key} className="apill" onClick={p.drop}>{p.text}<Icon name="close" size={13} /></button>)}
        <button className="link-btn" onClick={() => setF(EMPTY_FILTER)}>{t('srch.clear')}</button>
      </div>}

      {!searching ? <>
        <MonthNav ym={current} onChange={onMonth} />
        <Swipe id={`${current.year}-${current.month}`} onPrev={() => onMonth(prevMonth(current))} onNext={() => onMonth(nextMonth(current))} hint>
          <TransactionsView r={result} settings={s} undated={undated(data.transactions)} onOpen={onOpen} />
        </Swipe>
      </> : <>
        {eff === 'month' && <MonthNav ym={current} onChange={onMonth} />}
        <div className="results-head">
          <b>{list.length === 1 ? t('srch.one') : t('srch.results', { n: list.length })}{q.trim() && period === 'month' && <small className="muted"> · {t('srch.everywhere')}</small>}</b>
          {list.length > 0 && <span className={signedTotal(list) >= 0 ? 'good-text' : ''}>{t('srch.total', { amount: money(signedTotal(list), s.currency) })}</span>}
        </div>
        {list.length === 0 ? (
          <Empty title={t('srch.none')} text={t('srch.noneHint')} quiet
            action={{ label: t('srch.clear'), onClick: () => { setQ(''); setF(EMPTY_FILTER); setPeriod('month') } }} />
        ) : (
          <section className="card activity results">
            {groups.slice(0, 120).map(g => (
              <div key={g.day}>
                <p className="day-label day-sum"><span>{label(g.day)}</span><span>{money(signedTotal(g.items), s.currency)}</span></p>
                <ul className="tx-list">{g.items.map(tx => <TxRow key={`${tx.id}-${tx.date}`} tx={tx} settings={s} onOpen={onOpen} />)}</ul>
              </div>
            ))}
            {groups.length > 120 && <p className="muted small">{t('srch.more')}</p>}
          </section>
        )}
      </>}

      <Sheet open={open} onClose={() => setOpen(false)} title={t('srch.filters')}>
        <FilterSheet value={f} pool={searching ? pool : transactionsInMonths(monthsBetween(periodStart(period, current, s), current, s), data.transactions, s, today)}
                     q={q} names={names} data={data} onApply={v => { setF(v); setOpen(false) }} />
      </Sheet>
    </div>
  )
}

function FilterSheet({ value, pool, q, names, data, onApply }: {
  value: TxFilter; pool: ClassifiedTx[]; q: string; names: { category: (id: string | null) => string; bucket: (id: string | null) => string }
  data: AppData; onApply: (f: TxFilter) => void
}) {
  const { t, lang } = useI18n()
  const s = data.settings
  const [d, setD] = useState(value)
  const [min, setMin] = useState(value.min != null ? amountText(value.min, lang) : '')
  const [max, setMax] = useState(value.max != null ? amountText(value.max, lang) : '')
  const draft: TxFilter = { ...d, min: min.trim() ? parseAmount(min) : null, max: max.trim() ? parseAmount(max) : null }
  const count = filterTransactions(pool, { ...draft, q }, names).length
  const toggle = <K extends 'types' | 'buckets' | 'categories'>(k: K, v: string) =>
    setD({ ...d, [k]: (d[k] as string[]).includes(v) ? (d[k] as string[]).filter(x => x !== v) : [...(d[k] as string[]), v] })
  const cats = s.categories.filter(c => !d.types.length || d.types.includes(c.type))
  return (
    <div className="filters">
      <p className="txs-label">{t('srch.type')}</p>
      <div className="chips">{TYPES.map(x => <button key={x} className={`chip${d.types.includes(x) ? ' on' : ''}`} onClick={() => toggle('types', x)}>{t(`type.${x}` as keyof Dict)}</button>)}</div>
      <p className="txs-label">{t('srch.part')}</p>
      <div className="chips">{s.buckets.map((b, i) => <button key={b.id} className={`chip${d.buckets.includes(b.id) ? ' on' : ''}`} onClick={() => toggle('buckets', b.id)}>
        <i className="chip-dot" style={{ background: BUCKET_COLORS[i] }} />{bucketName(b, t)}</button>)}</div>
      <p className="txs-label">{t('srch.cat')}</p>
      <div className="chips">{cats.map(c => <button key={c.id} className={`chip${d.categories.includes(c.id) ? ' on' : ''}`} onClick={() => toggle('categories', c.id)}>{categoryName(c, t)}</button>)}</div>
      <p className="txs-label">{t('srch.amount')}</p>
      <div className="amount-range">
        <label><span>{t('srch.min')}</span><AmountInput value={min} onChange={setMin} placeholder="0" /></label>
        <span className="muted">–</span>
        <label><span>{t('srch.max')}</span><AmountInput value={max} onChange={setMax} placeholder="∞" /></label>
      </div>
      <div className="txs-actions">
        <button className="btn primary big-btn wide" onClick={() => onApply(draft)}>{count === 1 ? t('srch.showOne') : t('srch.show', { n: count })}</button>
        <button className="link-btn" onClick={() => { setD(EMPTY_FILTER); setMin(''); setMax('') }}>{t('srch.clear')}</button>
      </div>
    </div>
  )
}
