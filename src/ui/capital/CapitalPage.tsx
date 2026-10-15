// Profilo → Capitale: il saldo di partenza, diviso in destinazioni con una regola d'uso ciascuna.
// Si modifica su una bozza; "Salva il saldo" lo registra con la sua data e aggiunge un punto alla storia.
import { useMemo, useState } from 'react'
import { BIG_PURCHASES, CAPITAL_KINDS, CAPITAL_POLICIES, capitalSummary, defaultPolicy, todayIso, updateCapital,
  type Capital, type CapitalKind, type CapitalPart, type CapitalPolicy } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { newId } from '../../store/state'
import { AmountInput } from '../kit/AmountInput'
import { Empty } from '../kit/Empty'
import { tap } from '../kit/motion'
import { Money } from '../kit/Money'
import { Outcome } from '../Outcome'

const k = (s: string) => s as keyof Dict

export function CapitalPage() {
  const { t, money, date, lang } = useI18n()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const cur = settings.currency
  const saved = settings.capital ?? null
  const goals = (state.data!.goals ?? []).filter(g => !g.removed)
  const [parts, setParts] = useState<CapitalPart[]>(() => saved?.parts ?? [])
  const [day, setDay] = useState(() => todayIso())
  const draft: Capital = { date: saved?.date ?? day, parts, history: saved?.history ?? [] }
  const sum = capitalSummary(draft)
  const changed = JSON.stringify(parts) !== JSON.stringify(saved?.parts ?? [])
  const pct = (n: number | null) => n == null ? '—' : new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(n)

  const edit = (id: string, patch: Partial<CapitalPart>) => setParts(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  const add = () => { tap(); setParts(ps => [...ps, { id: newId(), name: '', kind: 'liquid', amount: 0, policy: 'always' }]) }
  const save = () => {
    tap()
    const clean = parts.filter(p => p.amount > 0 || p.name.trim()).map(p => ({ ...p, name: p.name.trim() || t(k(`cap.kind.${p.kind}`)) }))
    dispatch({ type: 'setSettings', settings: { ...settings, capital: updateCapital(saved ?? { date: day, parts: [], history: [] }, clean, day) } })
    setParts(clean)
  }

  if (!saved && !parts.length) return <Empty title={t('cap.emptyTitle')} text={t('cap.emptyText')} action={{ label: t('cap.start'), onClick: add }} />

  return <>
    <Outcome value={sum.total} currency={cur} label={t('cap.totalLabel', { date: date(saved?.date ?? day, { day: 'numeric', month: 'long', year: 'numeric' }) })}
      totals={[{ label: t('cap.protected'), value: sum.protected }, { label: t('cap.usable'), value: sum.usable }, { label: t('cap.preserved'), value: pct(sum.preserved) }]}>
      {(saved?.history.length ?? 0) > 1 && <Trend history={saved!.history} />}
    </Outcome>

    <h2 className="sec-title">{t('cap.parts')}</h2>
    <ul className="group-list inv-items cap-parts">
      {parts.map(p => (
        <li key={p.id}><details open={!p.name}>
          <summary className="row">
            <span className="row-main"><span>{p.name || t(k(`cap.kind.${p.kind}`))}</span><small>{t(k(`cap.policy.${p.policy}`))}</small></span>
            <span className="row-value"><Money value={p.amount} currency={cur} /></span>
          </summary>
          <div className="txs-rows">
            <label className="txs-row"><span>{t('cap.name')}</span><input value={p.name} maxLength={40} placeholder={t(k(`cap.kind.${p.kind}`))} onChange={e => edit(p.id, { name: e.target.value })} /></label>
            <label className="txs-row"><span>{t('cap.amount')}</span><AmountInput defaultValue={p.amount || null} onValue={n => edit(p.id, { amount: n ?? 0 })} /></label>
            <label className="txs-row"><span>{t('cap.kind')}</span>
              <select value={p.kind} onChange={e => { const kind = e.target.value as CapitalKind; edit(p.id, { kind, policy: defaultPolicy(kind) }) }}>
                {CAPITAL_KINDS.map(x => <option key={x} value={x}>{t(k(`cap.kind.${x}`))}</option>)}</select></label>
            <label className="txs-row"><span>{t('cap.policy')}</span>
              <select value={p.policy} onChange={e => edit(p.id, { policy: e.target.value as CapitalPolicy })}>
                {CAPITAL_POLICIES.map(x => <option key={x} value={x}>{t(k(`cap.policy.${x}`))}</option>)}</select></label>
            {p.kind === 'goal' && goals.length > 0 && <label className="txs-row"><span>{t('cap.goal')}</span>
              <select value={p.goalId ?? ''} onChange={e => edit(p.id, { goalId: e.target.value || null })}>
                <option value="">—</option>{goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
          </div>
          {p.policy === 'big' && <div className="nf-options cap-big">{BIG_PURCHASES.map(b => {
            const on = (p.bigPurchases ?? []).includes(b)
            return <button key={b} className={on ? 'on' : ''} aria-pressed={on} onClick={() => { tap(); edit(p.id, { bigPurchases: on ? p.bigPurchases!.filter(x => x !== b) : [...(p.bigPurchases ?? []), b] }) }}>{t(k(`cap.big.${b}`))}</button>
          })}</div>}
          {p.policy === 'custom' && <label className="txs-row"><span>{t('cap.rule')}</span><input value={p.rule ?? ''} maxLength={80} placeholder={t('cap.rulePh')} onChange={e => edit(p.id, { rule: e.target.value })} /></label>}
          <button className="link-btn danger-link" onClick={() => setParts(ps => ps.filter(x => x.id !== p.id))}>{t('action.delete')}</button>
        </details></li>
      ))}
    </ul>
    <button className="link-btn inv-add" onClick={add}>+ {t('cap.add')}</button>
    <p className="group-foot">{t('cap.hint')}</p>

    <div className="txs-rows">
      <label className="txs-row"><span>{t('cap.date')}</span><input type="date" value={day} max={todayIso()} onChange={e => setDay(e.target.value || todayIso())} /></label>
    </div>
    <button className="btn primary big-btn wide top-gap" disabled={!changed && !!saved && day === saved.date} onClick={save}>{t('cap.save')}</button>
    <p className="group-foot">{t('cap.note', { total: money(sum.total, cur) })}</p>
  </>
}

/** L'andamento del capitale: una linea sottile tra il primo e l'ultimo aggiornamento. */
export function Trend({ history }: { history: Capital['history'] }) {
  const pts = useMemo(() => {
    const max = Math.max(...history.map(h => h.total)), min = Math.min(...history.map(h => h.total))
    const span = Math.max(1, max - min)
    return history.map((h, i) => `${(i / Math.max(1, history.length - 1)) * 100},${36 - ((h.total - min) / span) * 32}`).join(' ')
  }, [history])
  return <svg className="cap-trend" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} /></svg>
}
