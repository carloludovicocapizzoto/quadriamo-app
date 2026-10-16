// Nuovo evento o modifica: tipo, nome, importo e categoria (per i pagamenti che entrano nel budget), prima data,
// ripetizione (le più comuni con un nome, oppure "ogni N giorni/settimane/mesi/anni") e fine (mai, dopo N volte, in una data).
import { useState } from 'react'
import {
  EVENT_KINDS, KIND_SIDE, REPEAT_PRESETS, presetOf, remainingCount, untilAfterCount,
  type CalEvent, type EventKind, type Repeat, type RepeatPreset,
} from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { AmountInput } from '../kit/AmountInput'
import { amountText, parseAmount } from '../kit/amount'
import { tap } from '../kit/motion'
import { categoryName } from '../names'
import type { Settings } from '../../engine'

const k = (s: string) => s as keyof Dict
const PRESETS: (RepeatPreset | 'once' | 'custom')[] = ['once', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly', 'custom']
/** La categoria proposta per un tipo di pagamento (si può cambiare). */
const KIND_CATEGORY: Partial<Record<EventKind, string>> = { rent: 'rent', bill: 'fixedCosts', loan: 'loans', mortgage: 'loans', subscription: 'fixedCosts', tax: 'other' }


export function EventForm({ event, settings, today, onSave, onDelete }: {
  event: CalEvent; settings: Settings; today: string; onSave: (e: CalEvent) => void; onDelete?: () => void
}) {
  const { t, lang } = useI18n()
  const [e, setE] = useState(event)
  const [amount, setAmount] = useState(event.amount != null ? amountText(event.amount, lang) : '')
  const [preset, setPreset] = useState(presetOf(event.repeat))
  const [end, setEnd] = useState<'never' | 'count' | 'date'>(event.until ? 'date' : 'never')
  const [count, setCount] = useState(String(remainingCount(event, event.date) ?? 12))
  const [err, setErr] = useState('')
  const set = (p: Partial<CalEvent>) => setE(x => ({ ...x, ...p }))
  const side = KIND_SIDE[e.kind]
  const spending = settings.categories.filter(c => c.type !== 'income')

  const pickKind = (kind: EventKind) => {
    tap()
    const out = KIND_SIDE[kind] === 'out'
    set({ kind, category: out ? (e.category && KIND_SIDE[e.kind] === 'out' ? e.category : KIND_CATEGORY[kind] ?? 'other') : null,
      repeat: kind === 'reminder' || kind === 'tax' ? null : e.repeat ?? { every: 1, unit: 'month' } })
    if (kind === 'reminder' || kind === 'tax') setPreset('once')
  }
  const pickPreset = (p: typeof preset) => {
    tap(); setPreset(p)
    set({ repeat: p === 'once' ? null : p === 'custom' ? e.repeat ?? { every: 1, unit: 'week' } : { ...REPEAT_PRESETS[p] } })
  }
  function save() {
    const value = parseAmount(amount)
    if (!e.title.trim()) return setErr(t('ev.errTitle'))
    if (!e.date) return setErr(t('ev.errDate'))
    if (side === 'out' && e.category && !(value && value > 0)) return setErr(t('ev.errAmount'))
    const until = !e.repeat || end === 'never' ? null
      : end === 'count' ? untilAfterCount(e, Math.max(1, Number(count) || 1)) : e.until && e.until >= e.date ? e.until : null
    onSave({ ...e, title: e.title.trim().slice(0, 60), amount: value && value > 0 ? value : null,
      category: side === 'out' ? e.category : null, until })
  }

  return (
    <div className="event-form">
      <div className="chips ev-kinds" role="radiogroup" aria-label={t('ev.kind')}>
        {EVENT_KINDS.map(kind => <button key={kind} type="button" role="radio" aria-checked={e.kind === kind}
          className={`chip${e.kind === kind ? ' on' : ''}`} onClick={() => pickKind(kind)}>{t(k(`ev.kind.${kind}`))}</button>)}
      </div>

      <div className="txs-rows">
        <label className="txs-row"><span>{t('ev.title')}</span>
          <input value={e.title} maxLength={60} placeholder={t(k(`ev.ph.${e.kind}`))} onChange={x => set({ title: x.target.value })} /></label>
        {side !== 'none' && <label className="txs-row"><span>{t('ev.amount')}</span>
          <AmountInput value={amount} onChange={setAmount} placeholder={t('ev.optional')} aria-label={t('ev.amount')} /></label>}
        {side === 'out' && <label className="txs-row"><span>{t('ev.category')}</span>
          <select value={e.category ?? ''} onChange={x => set({ category: x.target.value || null })}>
            {spending.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
            <option value="">{t('ev.noBudget')}</option>
          </select></label>}
        <label className="txs-row"><span>{e.repeat ? t('ev.first') : t('ev.date')}</span>
          <input type="date" value={e.date} onChange={x => set({ date: x.target.value || today })} /></label>
      </div>
      {side === 'out' && <p className="small muted">{e.category ? t('ev.inBudgetHint') : t('ev.noBudgetHint')}</p>}

      <p className="small fb-q"><b>{t('ev.repeat')}</b></p>
      <div className="chips" role="radiogroup" aria-label={t('ev.repeat')}>
        {PRESETS.map(p => <button key={p} type="button" role="radio" aria-checked={preset === p}
          className={`chip${preset === p ? ' on' : ''}`} onClick={() => pickPreset(p)}>{t(k(`rp.${p}`))}</button>)}
      </div>
      {preset === 'custom' && e.repeat && <div className="txs-rows">
        <label className="txs-row"><span>{t('ev.every')}</span>
          <span className="ev-every">
            <input type="number" inputMode="numeric" min={1} max={99} value={e.repeat.every}
              onChange={x => set({ repeat: { ...e.repeat!, every: Math.max(1, Math.min(99, Number(x.target.value) || 1)) } })} />
            <select value={e.repeat.unit} onChange={x => set({ repeat: { ...e.repeat!, unit: x.target.value as Repeat['unit'] } })}>
              {(['day', 'week', 'month', 'year'] as const).map(u => <option key={u} value={u}>{t(k(`unit.${u}`))}</option>)}
            </select>
          </span></label>
      </div>}

      {e.repeat && <>
        <p className="small fb-q"><b>{t('ev.end')}</b></p>
        <div className="chips" role="radiogroup" aria-label={t('ev.end')}>
          {(['never', 'count', 'date'] as const).map(x => <button key={x} type="button" role="radio" aria-checked={end === x}
            className={`chip${end === x ? ' on' : ''}`} onClick={() => { tap(); setEnd(x) }}>{t(k(`end.${x}`))}</button>)}
        </div>
        {end === 'count' && <div className="txs-rows"><label className="txs-row"><span>{t('ev.times')}</span>
          <input type="number" inputMode="numeric" min={1} max={600} value={count} onChange={x => setCount(x.target.value)} /></label></div>}
        {end === 'date' && <div className="txs-rows"><label className="txs-row"><span>{t('ev.lastTime')}</span>
          <input type="date" min={e.date} value={e.until ?? ''} onChange={x => set({ until: x.target.value || null })} /></label></div>}
      </>}

      {err && <p className="small bad-text" role="alert">{err}</p>}
      <button className="btn primary wide top-gap" onClick={save}>{onDelete ? t('action.save') : t('ev.create')}</button>
      {onDelete && <button className="link-btn danger-link" onClick={() => { if (confirm(t('ev.confirmDelete'))) onDelete() }}>{t('ev.delete')}</button>}
    </div>
  )
}
