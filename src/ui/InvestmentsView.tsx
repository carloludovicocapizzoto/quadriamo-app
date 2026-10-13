import { useMemo } from 'react'
import {
  computeYear, emptyInvestments, pacFutureValue, pacProjection, pacTracker, portfolioSummary,
  type Investments, type Settings, type Transaction,
} from '../engine'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { newId, parseAmount } from '../store/state'
import { CURRENCIES } from './names'
import { YearNav } from './YearView'
import { AmountInput } from './kit/AmountInput'

const TYPES = ['etf', 'stock', 'bond', 'fund', 'crypto', 'other'] as const
const num = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','))

export function InvestmentsView({ settings, transactions, today, year, onYear }: {
  settings: Settings; transactions: Transaction[]; today: string; year: number; onYear: (y: number) => void
}) {
  const { t, money, lang } = useI18n()
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
      <section className="card">
        <h3 className="h-plain">{t('inv.overview')}</h3>
        <dl className="summary">
          <div><dt>{t('inv.invested')}</dt><dd>{money(o.invested, cur)}</dd></div>
          <div><dt>{t('inv.value')}</dt><dd>{money(o.value, cur)}</dd></div>
          <div><dt>{t('inv.gain')}</dt><dd className={o.gain < 0 ? 'bad-text' : 'good-text'}>{money(o.gain, cur)}</dd></div>
          <div><dt>{t('inv.return')}</dt><dd className={(o.return ?? 0) < 0 ? 'bad-text' : ''}>{pct(o.return)}</dd></div>
        </dl>
        <p className="muted small top-gap">{t('inv.disclaimer')}</p>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('inv.holdings')}</h3>
        <p className="muted small">{t('inv.holdingsHint')}</p>
        {o.holdings.length === 0 && <p className="muted small">{t('inv.empty')}</p>}
        <div className="inv-list">
          {o.holdings.map(({ holding: h, invested, value, gain, return: r, missingValue }, i) => (
            <article key={h.id} className={`inv-card${missingValue ? ' tx-bad' : ''}`}>
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
                  <input inputMode="decimal" defaultValue={num(h.units)} onChange={e => save(x => { x.holdings[i].units = parseAmount(e.target.value) })} /></label>
                <label className="field"><span>{t('inv.avgPrice')}</span>
                  <input inputMode="decimal" defaultValue={num(h.avgPrice)} onChange={e => save(x => { x.holdings[i].avgPrice = parseAmount(e.target.value) })} /></label>
                <label className="field"><span>{t('inv.price')}</span>
                  <input inputMode="decimal" defaultValue={num(h.manualPrice)} onChange={e => save(x => { x.holdings[i].manualPrice = parseAmount(e.target.value) })} /></label>
              </div>
              <dl className="mini four">
                <div><dt>{t('inv.invested')}</dt><dd>{invested != null ? money(invested, cur) : '—'}</dd></div>
                <div><dt>{t('inv.value')}</dt><dd>{value != null ? money(value, cur) : '—'}</dd></div>
                <div><dt>{t('inv.gain')}</dt><dd className={(gain ?? 0) < 0 ? 'bad-text' : ''}>{gain != null ? money(gain, cur) : '—'}</dd></div>
                <div><dt>{t('inv.return')}</dt><dd className={(r ?? 0) < 0 ? 'bad-text' : ''}>{pct(r)}</dd></div>
              </dl>
              {missingValue && h.currency && <p className="bad-text small">{t('inv.missingRate', { cur: h.currency })}</p>}
              <button className="link-btn danger-link" onClick={() => save(x => { x.holdings.splice(i, 1) })}>{t('action.delete')}</button>
            </article>
          ))}
        </div>
        <button className="btn" onClick={() => save(x => {
          x.holdings.push({ id: newId(), name: '', type: 'etf', currency: null, units: null, avgPrice: null, manualPrice: null })
        })}>+ {t('inv.addHolding')}</button>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('inv.deposits')}</h3>
        <p className="muted small">{t('inv.depositsHint')}</p>
        <div className="inv-list">
          {o.deposits.map(({ deposit: d, interest, value, maturity }, i) => (
            <article key={d.id} className="inv-card">
              <div className="inv-grid">
                <label className="field wide"><span>{t('inv.name')}</span>
                  <input defaultValue={d.name} onChange={e => save(x => { x.deposits[i].name = e.target.value })} /></label>
                <label className="field"><span>{t('inv.amount')}</span>
                  <AmountInput defaultValue={d.amount} onValue={n => save(x => { x.deposits[i].amount = n ?? 0 })} /></label>
                <label className="field"><span>{t('inv.rate')}</span>
                  <input inputMode="decimal" defaultValue={num(Math.round(d.yearlyRate * 10000) / 100)}
                         onChange={e => save(x => { x.deposits[i].yearlyRate = (parseAmount(e.target.value) ?? 0) / 100 })} /></label>
                <label className="field"><span>{t('inv.start')}</span>
                  <input type="date" defaultValue={d.start} onChange={e => save(x => { x.deposits[i].start = e.target.value })} /></label>
                <label className="field"><span>{t('inv.term')}</span>
                  <input inputMode="numeric" defaultValue={d.termMonths ?? ''}
                         onChange={e => save(x => { x.deposits[i].termMonths = e.target.value ? Number(e.target.value) : null })} /></label>
              </div>
              <dl className="mini">
                <div><dt>{t('inv.interest')}</dt><dd>{money(interest, cur)}</dd></div>
                <div><dt>{t('inv.value')}</dt><dd>{money(value, cur)}</dd></div>
                <div><dt>{t('inv.maturity')}</dt><dd>{maturity ?? '—'}</dd></div>
              </dl>
              <button className="link-btn danger-link" onClick={() => save(x => { x.deposits.splice(i, 1) })}>{t('action.delete')}</button>
            </article>
          ))}
        </div>
        <button className="btn" onClick={() => save(x => {
          x.deposits.push({ id: newId(), name: '', amount: 0, yearlyRate: 0.03, start: today, termMonths: 12 })
        })}>+ {t('inv.addDeposit')}</button>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('inv.pac')}</h3>
        <div className="inv-grid">
          <label className="field"><span>{t('inv.monthly')} ({cur})</span>
            <AmountInput defaultValue={inv.pac.monthly} onValue={n => save(x => { x.pac.monthly = n ?? 0 })} /></label>
          <label className="field"><span>{t('inv.expected')}</span>
            <input inputMode="decimal" defaultValue={num(Math.round(inv.pac.yearlyReturn * 10000) / 100)}
                   onChange={e => save(x => { x.pac.yearlyReturn = (parseAmount(e.target.value) ?? 0) / 100 })} /></label>
          <label className="field"><span>{t('inv.years')}</span>
            <input inputMode="numeric" defaultValue={inv.pac.years}
                   onChange={e => save(x => { x.pac.years = Math.min(60, Math.max(0, Number(e.target.value) || 0)) })} /></label>
        </div>
        <dl className="summary">
          <div><dt>{t('inv.putIn')}</dt><dd>{money(putIn, cur)}</dd></div>
          <div><dt>{t('inv.projected')}</dt><dd>{money(fv, cur)}</dd></div>
          <div><dt>{t('inv.growth')}</dt><dd className="good-text">{money(fv - putIn, cur)}</dd></div>
        </dl>
        <PacChart rows={proj} />
        <p className="muted small">{t('inv.projectionNote')}</p>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('inv.tracker')}</h3>
        <YearNav year={year} onChange={onYear} />
        <p className="muted small">{t('inv.trackerHint')}</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>{t('year.month')}</th><th>{t('inv.planned')}</th><th>{t('inv.investedMonth')}</th><th>{t('inv.diff')}</th>
              <th>{t('inv.total')}</th><th>{t('inv.portfolio')}</th><th>{t('inv.gain')}</th></tr></thead>
            <tbody>
              {tracker.map(r => (
                <tr key={r.key}>
                  <th scope="row">{t(`m.${r.month}` as 'm.1')}</th>
                  <td>{money(r.planned, cur)}</td>
                  <td>{r.invested ? money(r.invested, cur) : '—'}</td>
                  <td className={(r.difference ?? 0) < 0 ? 'bad-text' : ''}>{r.difference != null ? money(r.difference, cur) : '—'}</td>
                  <td>{r.totalInvested != null ? money(r.totalInvested, cur) : '—'}</td>
                  <td><input className="cell-input" inputMode="decimal" aria-label={`${t('inv.portfolio')} ${t(`m.${r.month}` as 'm.1')}`}
                             defaultValue={num(r.value)} key={r.key}
                             onChange={e => save(x => {
                               const v = parseAmount(e.target.value)
                               if (v == null) delete x.portfolioValues[r.key]; else x.portfolioValues[r.key] = v
                             })} /></td>
                  <td className={(r.gain ?? 0) < 0 ? 'bad-text' : 'good-text'}>{r.gain != null ? money(r.gain, cur) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/** Proiezione del PAC: versato (grigio) e valore atteso (arancio), anno per anno. */
function PacChart({ rows }: { rows: { year: number; putIn: number; value: number }[] }) {
  if (rows.length < 2) return null
  const W = 320, H = 120, max = Math.max(...rows.map(r => r.value), 1)
  const pts = (k: 'putIn' | 'value') => rows.map((r, i) => `${(i / (rows.length - 1)) * W},${H - (r[k] / max) * H}`).join(' ')
  return (
    <svg className="pac-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={pts('putIn')} fill="none" stroke="var(--b4)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <polyline points={pts('value')} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
