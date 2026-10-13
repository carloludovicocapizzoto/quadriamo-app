import { useState } from 'react'
import { goalStatus, type Goal } from '../../engine'
import { useI18n } from '../../i18n/core'
import { useStore } from '../../store/context'
import { newId, parseAmount } from '../../store/state'
import { Icon, type IconName } from '../Icon'
import { Ring } from '../kit/Ring'
import { tap, useCountUp } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { AmountInput } from '../kit/AmountInput'
import { amountText } from '../kit/amount'

const GOAL_ICONS: IconName[] = ['target', 'plane', 'home', 'car', 'gift', 'heart', 'growth']
const live = (goals: Goal[] | undefined) => (goals ?? []).filter(g => !g.removed)

/** Profilo: i tuoi obiettivi di risparmio come tessere da scorrere, più "Nuovo obiettivo". */
export function GoalsStrip({ goals, today, currency, titled = true }: { goals: Goal[] | undefined; today: string; currency: string; titled?: boolean }) {
  const { t, money } = useI18n()
  const [open, setOpen] = useState<string | 'new' | null>(null)
  const list = live(goals)
  const current = list.find(g => g.id === open) ?? null
  return (
    <>
      {titled && <div className="sec-head"><h2 className="sec-title">{t('goal.title')}</h2>
        {list.length > 0 && <button className="link-btn" onClick={() => { tap(); setOpen('new') }}><Icon name="plus" size={16} />{t('goal.new')}</button>}</div>}
      <div className="goals" role="list">
        {list.map(g => {
          const s = goalStatus(g, today)
          return (
            <button key={g.id} role="listitem" className={`goal${s.done ? ' done' : ''}`} onClick={() => { tap(); setOpen(g.id) }}>
              <Ring value={s.pct} size={58} stroke={6} color={s.done ? 'var(--good)' : 'var(--accent)'}>
                <span className="goal-ico"><Icon name={(s.done ? 'check' : g.icon) as IconName} size={22} /></span></Ring>
              <b className="goal-name">{g.name}</b>
              <span className="goal-amt">{money(s.saved, currency)}</span>
              <span className="goal-of">{t('goal.of', { amount: money(g.target, currency) })}</span>
              <span className={`goal-sub${s.late ? ' bad-text' : s.onTrack === false ? ' warn-text' : ''}`}>
                {s.done ? t('goal.reached') : s.late ? t('goal.late') : s.perMonth != null ? t('goal.perMonth', { amount: money(s.perMonth, currency) }) : t('goal.pct', { n: Math.round(s.pct * 100) })}
              </span>
            </button>
          )
        })}
        <button className="goal goal-add" onClick={() => { tap(); setOpen('new') }}>
          <span className="goal-plus"><Icon name="plus" size={26} /></span>
          <b className="goal-name">{t('goal.new')}</b>
          {!list.length && <span className="goal-sub">{t('goal.emptyHint')}</span>}
        </button>
      </div>

      <Sheet open={open === 'new'} onClose={() => setOpen(null)} title={t('goal.new')}>
        {open === 'new' && <GoalForm today={today} currency={currency} onDone={() => setOpen(null)} />}
      </Sheet>
      <Sheet open={!!current} onClose={() => setOpen(null)}>
        {current && <GoalDetail goal={current} today={today} currency={currency} onClose={() => setOpen(null)} />}
      </Sheet>
    </>
  )
}

function GoalDetail({ goal, today, currency, onClose }: { goal: Goal; today: string; currency: string; onClose: () => void }) {
  const { t, money, date } = useI18n()
  const { dispatch } = useStore()
  const [edit, setEdit] = useState(false)
  const [raw, setRaw] = useState('')
  const [party, setParty] = useState(false)
  const s = goalStatus(goal, today)
  const saved = useCountUp(s.saved)
  const add = (amount: number) => {
    if (!amount) return
    tap()
    const before = s.done
    dispatch({ type: 'goalMoney', id: goal.id, amount, date: today })
    setRaw('')
    if (!before && s.saved + amount >= goal.target) { setParty(true); setTimeout(() => setParty(false), 3200) }
  }
  if (edit) return <GoalForm goal={goal} today={today} currency={currency} onDone={() => setEdit(false)} onDelete={() => { dispatch({ type: 'deleteGoal', id: goal.id }); onClose() }} />
  const typed = parseAmount(raw)
  return (
    <div className="goal-detail">
      <div className="gd-head">
        <Ring value={s.pct} size={132} stroke={11} color={s.done ? 'var(--good)' : 'var(--accent)'}>
          <span className="gd-pct"><Icon name={goal.icon as IconName} size={26} /><b>{Math.round(s.pct * 100)}%</b></span></Ring>
        <h2>{goal.name}</h2>
        <p className="gd-amt">{money(saved, currency)} <span className="muted">/ {money(goal.target, currency)}</span></p>
        <p className={`small ${s.done ? 'good-text' : s.late ? 'bad-text' : 'muted'}`}>
          {s.done ? t('goal.reachedLong') : s.late ? t('goal.lateLong', { amount: money(s.left, currency) })
            : goal.deadline ? t('goal.plan', { amount: money(s.perMonth ?? 0, currency), n: s.monthsLeft ?? 0, left: money(s.left, currency) })
            : t('goal.leftOnly', { amount: money(s.left, currency) })}
        </p>
        {s.onTrack === false && !s.late && !s.done && <p className="small warn-text">{t('goal.behind')}</p>}
      </div>

      {!s.done && <>
        <div className="gd-quick">{[10, 50, 100].map(n => <button key={n} className="gd-chip" onClick={() => add(n)}>+{money(n, currency).replace(/[,.]00/, '')}</button>)}</div>
        <div className="gd-input">
          <AmountInput placeholder={t('goal.amountPh')} value={raw} onChange={setRaw} aria-label={t('goal.amountPh')} />
          <button className="btn primary" disabled={!typed || typed <= 0} onClick={() => add(typed ?? 0)}><Icon name="plus" size={16} />{t('goal.add')}</button>
          <button className="btn" disabled={!typed || typed <= 0 || typed > s.saved} onClick={() => add(-(typed ?? 0))} aria-label={t('goal.take')}><Icon name="minus" size={16} /></button>
        </div>
        <p className="small muted">{t('goal.hint')}</p>
      </>}

      {goal.contributions.length > 0 && <>
        <p className="day-label">{t('goal.history')}</p>
        <ul className="gd-hist">{[...goal.contributions].reverse().slice(0, 12).map(c => (
          <li key={c.id}><span>{date(c.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <b className={c.amount < 0 ? 'bad-text' : 'good-text'}>{c.amount < 0 ? '−' : '+'}{money(Math.abs(c.amount), currency)}</b></li>))}
        </ul>
      </>}
      <button className="btn wide top-gap" onClick={() => setEdit(true)}><Icon name="edit" size={16} />{t('goal.edit')}</button>

      {party && <div className="streak-pop big goal-party" role="status" onClick={() => setParty(false)}>
        <span className="party-ico"><Icon name="check" size={36} /></span><b>{t('goal.partyTitle')}</b><span>{goal.name}</span></div>}
    </div>
  )
}

function GoalForm({ goal, today, currency, onDone, onDelete }: { goal?: Goal; today: string; currency: string; onDone: () => void; onDelete?: () => void }) {
  const { t, lang } = useI18n()
  const { dispatch } = useStore()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? amountText(goal.target, lang) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [err, setErr] = useState('')
  const amount = parseAmount(target)
  function save() {
    if (!name.trim()) return setErr(t('goal.errName'))
    if (!amount || amount <= 0) return setErr(t('goal.errTarget'))
    dispatch({ type: 'saveGoal', goal: { id: goal?.id ?? newId(), name: name.trim().slice(0, 40), target: amount, deadline: deadline || null, icon,
      contributions: goal?.contributions ?? [], createdAt: goal?.createdAt ?? today, updatedAt: '' } })
    onDone()
  }
  return (
    <div className="goal-form">
      <div className="gf-icons" role="radiogroup" aria-label={t('goal.icon')}>
        {GOAL_ICONS.map(i => <button key={i} role="radio" aria-checked={icon === i} className={icon === i ? 'on' : ''} onClick={() => { tap(); setIcon(i) }}><Icon name={i} size={22} /></button>)}
      </div>
      <div className="txs-rows">
        <label className="txs-row"><span>{t('goal.name')}</span><input value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder={t('goal.namePh')} /></label>
        <label className="txs-row"><span>{t('goal.target')}</span><AmountInput value={target} onChange={setTarget} placeholder={`600 ${currency === 'EUR' ? '€' : currency}`} /></label>
        <label className="txs-row"><span>{t('goal.deadline')}</span><input type="month" value={deadline} min={today.slice(0, 7)} onChange={e => setDeadline(e.target.value)} /></label>
      </div>
      <p className="small muted txs-hint">{t('goal.deadlineHint')}</p>
      {err && <p className="small bad-text">{err}</p>}
      <button className="btn primary big-btn wide top-gap" onClick={save}>{goal ? t('action.save') : t('goal.create')}</button>
      {goal && onDelete && <button className="link-btn danger-link wide-center" onClick={() => { if (confirm(t('goal.confirmDelete'))) onDelete() }}>{t('goal.delete')}</button>}
    </div>
  )
}
