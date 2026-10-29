import { useMemo } from 'react'
import { navigate } from '../app/router'
import { Icon } from './Icon'
import {
  capitalSummary,
  computeYear, emptyInvestments, pacFutureValue, pacProjection, pacTracker, portfolioSummary,
  type Investments, type Settings, type Transaction,
} from '../engine'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { newId } from '../store/state'
import { decimalText, parseDecimal } from './kit/decimal'
import { CURRENCIES } from './names'
import { YearNav } from './YearView'
import { AmountInput } from './kit/AmountInput'
import { Money } from './kit/Money'
import { Outcome } from './Outcome'
import { Empty } from './kit/Empty'

const TYPES = ['etf', 'stock', 'bond', 'fund', 'crypto', 'other'] as const

export function InvestmentsView({ settings, transactions, today, year, onYear }: {
  settings: Settings; transactions: Transaction[]; today: string; year: number; onYear: (y: number) => void
}) {
  const { t, money, lang } = useI18n()
  const num = (v: number | null | undefined) => decimalText(v, lang)
  const { state, dispatch } = useStore()
  const inv: Investments = state.data?.investments ?? emptyInvestments()
  const cur = settings.currency
  const pct = (n: number | null) => n == null ? '—' : new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }).format(n)
  const save = (fn: (x: Investments) => void) => { const next = structuredClone(inv); fn(next); dispatch({ type: 'setInvestments', investments: next }) }

  const o = portfolioSummary(inv, settings, today)
  const proj = pacProjection(inv.pac)
  const months = useMemo(() => computeYear(year, transactions, settings, today).months, [year, transactions, settings, today])
  const tracker = pacTracker(months, inv.pac, inv.portfolioValues)
  const putIn = inv.pac.monthly * 12 * inv.pac.years
  const fv = pacFutureValue(inv.pac.monthly, inv.pac.yearlyReturn, inv.pac.years)

  return (
    <>
      {/* senza titoli né conti: cosa si fa qui, al posto di un valore a zero */}
      {o.holdings.length || inv.deposits.length
        ? <Outcome value={o.value} currency={cur} label={t('inv.valueToday')} detail={o.value == null || o.invested == null ? t('inv.incomplete') : undefined}
            totals={[{ label: t('inv.invested'), value: o.invested }, { label: t('inv.gain'), value: o.gain }, { label: t('inv.return'), value: pct(o.return) }]} />
        : <Empty title={t('inv.emptyTitle')} text={t('inv.emptyText')} />}

      {/* il capitale di partenza, accanto agli investimenti: il patrimonio in un colpo d'occhio */}
      {settings.capital?.parts.length ? <ul className="group-list cap-line"><li><button className="row" onClick={() => navigate({ tab: 'profile', page: 'capital' })}>
        <span className="row-main"><span>{t('prof.capital')}</span><small>{t('cap.line', { protected: money(capitalSummary(settings.capital).protected, cur), usable: money(capitalSummary(settings.capital).usable, cur) })}</small></span>
        <span className="row-value"><Money value={capitalSummary(settings.capital).total} currency={cur} /></span><Icon name="chevron" size={18} className="row-chev" />
      </button></li></ul> : null}

      {/* titoli: una riga ciascuno; i campi si aprono toccandola */}
      <h2 className="sec-title">{t('inv.holdings')}</h2>
      <ul className="group-list inv-items">
        {o.holdings.map(({ holding: h, invested, value, gain, return: r, missingValue, price, rate }, i) => (
          <li key={h.id}><details open={!h.name}>
            <summary className="row">
              <span className="row-main"><span>{h.name || t('inv.newHolding')}</span>
                <small>{t(`inv.t.${h.type ?? 'etf'}` as 'inv.t.etf')}{r != null ? ` · ${pct(r)}` : ''}{missingValue && price == null ? ` · ${t('inv.noValue')}` : ''}</small></span>
              <span className={`row-value${(gain ?? 0) < 0 ? ' bad-text' : ''}`}>{value != null ? money(value, cur) : '—'}</span>
            </summary>
            <div className="inv-grid">
              <label className="field wide"><span>{t('inv.name')}</span>
                <input defaultValue={h.name} onChange={e => save(x => { x.holdings[i].name = e.target.value })} /></label>
              <label className="field"><span>{t('inv.type')}</span>
                <select value={h.type ?? 'etf'} onChange={e => save(x => { x.holdings[i].type = e.target.value })}>
                  {TYPES.map(ty => <option key={ty} value={ty}>{t(`inv.t.${ty}`)}</option>)}
                </select></label>
              <label className="field"><span>{t('inv.ticker')}</span>
                <input defaultValue={h.ticker ?? ''} onChange={e => save(x => { x.holdings[i].ticker = e.target.value })} /></label>
              <label className="field"><span>{t('inv.currency')}</span>
                <select value={h.currency || cur} onChange={e => save(x => { x.holdings[i].currency = e.target.value === cur ? null : e.target.value })}>
                  {[...new Set([cur, ...CURRENCIES])].map(c => <option key={c}>{c}</option>)}
                </select></label>
              <label className="field"><span>{t('inv.units')}</span>
                <input inputMode="decimal" defaultValue={num(h.units)} onChange={e => save(x => { x.holdings[i].units = parseDecimal(e.target.value) })} /></label>
              <label className="field"><span>{t('inv.avgPrice')}</span>
                <input inputMode="decimal" defaultValue={num(h.avgPrice)} onChange={e => save(x => { x.holdings[i].avgPrice = parseDecimal(e.target.value) })} /></label>
              <label className="field"><span>{t('inv.price')}</span>
                <input inputMode="decimal" defaultValue={num(h.manualPrice)} onChange={e => save(x => { x.holdings[i].manualPrice = parseDecimal(e.target.value) })} /></label>
            </div>
            <p className="inv-line">{t('inv.invested')} {invested != null ? money(invested, cur) : '—'} · {t('inv.gain')}{' '}
              <span className={(gain ?? 0) < 0 ? 'bad-text' : ''}>{gain != null ? money(gain, cur) : '—'}</span></p>
            {rate == null && h.currency && <p className="bad-text small">{t('inv.missingRate', { cur: h.currency })}</p>}
            <button className="link-btn danger-link" onClick={() => save(x => { x.holdings.splice(i, 1) })}>{t('action.delete')}</button>
          </details></li>
        ))}
      </ul>
      <button className="link-btn inv-add" onClick={() => save(x => {
        x.holdings.push({ id: newId(), name: '', type: 'etf', currency: null, units: null, avgPrice: null, manualPrice: null })
      })}>+ {t('inv.addHolding')}</button>
      <p className="group-foot">{t('inv.holdingsHint')}</p>

      <h2 className="sec-title">{t('inv.deposits')}</h2>
      <ul className="group-list inv-items">
        {o.deposits.map(({ deposit: d, interest, value, maturity }, i) => (
          <li key={d.id}><details open={!d.name}>
            <summary className="row">
              <span className="row-main"><span>{d.name || t('inv.newDeposit')}</span>
                <small>{pct(d.yearlyRate)}{maturity ? ` · ${t('inv.until', { date: maturity })}` : ''}</small></span>
              <span className="row-value">{money(value, cur)}</span>
            </summary>
            <div className="inv-grid">
              <label className="field wide"><span>{t('inv.name')}</span>
                <input defaultValue={d.name} onChange={e => save(x => { x.deposits[i].name = e.target.value })} /></label>
              <label className="field"><span>{t('inv.amount')}</span>
                <AmountInput defaultValue={d.amount} onValue={n => save(x => { x.deposits[i].amount = n ?? 0 })} /></label>
              <label className="field"><span>{t('inv.rate')}</span>
                <input inputMode="decimal" defaultValue={num(Math.round(d.yearlyRate * 10000) / 100)}
                       onChange={e => save(x => { x.deposits[i].yearlyRate = (parseDecimal(e.target.value) ?? 0) / 100 })} /></label>
              <label className="field"><span>{t('inv.start')}</span>
                <input type="date" defaultValue={d.start} onChange={e => save(x => { x.deposits[i].start = e.target.value })} /></label>
              <label className="field"><span>{t('inv.term')}</span>
                <input inputMode="numeric" defaultValue={d.termMonths ?? ''}
                       onChange={e => save(x => { x.deposits[i].termMonths = e.target.value ? Number(e.target.value) : null })} /></label>
            </div>
            <p className="inv-line">{t('inv.interest')} {money(interest, cur)}</p>
            <button className="link-btn danger-link" onClick={() => save(x => { x.deposits.splice(i, 1) })}>{t('action.delete')}</button>
          </details></li>
        ))}
      </ul>
      <button className="link-btn inv-add" onClick={() => save(x => {
        x.deposits.push({ id: newId(), name: '', amount: 0, yearlyRate: 0.03, start: today, termMonths: 12 })
      })}>+ {t('inv.addDeposit')}</button>
      <p className="group-foot">{t('inv.depositsHint')}</p>

      <h2 className="sec-title">{t('inv.pac')}</h2>
      <div className="txs-rows">
        <label className="txs-row"><span>{t('inv.monthly')}</span>
          <AmountInput defaultValue={inv.pac.monthly} onValue={n => save(x => { x.pac.monthly = n ?? 0 })} /></label>
        <label className="txs-row"><span>{t('inv.expected')}</span>
          <span className="txs-unit"><input inputMode="decimal" defaultValue={num(Math.round(inv.pac.yearlyReturn * 10000) / 100)}
                 onChange={e => save(x => { x.pac.yearlyReturn = (parseDecimal(e.target.value) ?? 0) / 100 })} /><i>%</i></span></label>
        <label className="txs-row"><span>{t('inv.years')}</span>
          <input inputMode="numeric" defaultValue={inv.pac.years}
                 onChange={e => save(x => { x.pac.years = Math.min(60, Math.max(0, Number(e.target.value) || 0)) })} /></label>
      </div>
      <dl className="outcome-row">
        <div><dt>{t('inv.putIn')}</dt><dd><Money value={putIn} currency={cur} /></dd></div>
        <div><dt>{t('inv.projected')}</dt><dd><Money value={fv} currency={cur} /></dd></div>
        <div><dt>{t('inv.growth')}</dt><dd><Money value={fv - putIn} currency={cur} /></dd></div>
      </dl>
      <PacChart rows={proj} />
      <p className="hc-legend-line small muted"><i className="lg-bar" /> {t('inv.putIn')} · <i className="lg-ink" /> {t('inv.projected')}</p>
      <p className="group-foot">{t('inv.projectionNote')}</p>

      <h2 className="sec-title">{t('inv.tracker')}</h2>
      <YearNav year={year} onChange={onYear} />
      <ul className="group-list inv-months">
        {tracker.map(r => (
          <li key={r.key}><label className="row">
            <span className="row-main"><span>{t(`m.${r.month}` as 'm.1')}</span>
              <small>{t('inv.monthLine', { invested: r.invested ? money(r.invested, cur) : '—', planned: money(r.planned, cur) })}
                {r.gain != null && <> · <span className={r.gain < 0 ? 'bad-text' : ''}>{money(r.gain, cur)}</span></>}</small></span>
            <AmountInput className="cell-input" placeholder={t('inv.valueShort')} aria-label={`${t('inv.portfolio')} ${t(`m.${r.month}` as 'm.1')}`}
              defaultValue={r.value} key={r.key} onValue={v => save(x => { if (v == null) delete x.portfolioValues[r.key]; else x.portfolioValues[r.key] = v })} />
          </label></li>
        ))}
      </ul>
      <p className="group-foot">{t('inv.trackerHint')}</p>
      <p className="group-foot">{t('inv.disclaimer')}</p>
    </>
  )
}

/** Proiezione del PAC: versato (chiaro) e valore atteso (inchiostro), anno per anno. */
function PacChart({ rows }: { rows: { year: number; putIn: number; value: number }[] }) {
  if (rows.length < 2) return null
  const W = 320, H = 120, max = Math.max(...rows.map(r => r.value), 1)
  const pts = (k: 'putIn' | 'value') => rows.map((r, i) => `${(i / (rows.length - 1)) * W},${H - (r[k] / max) * H}`).join(' ')
  return (
    <svg className="pac-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={pts('putIn')} fill="none" stroke="var(--fill-2)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <polyline points={pts('value')} fill="none" stroke="var(--text)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
