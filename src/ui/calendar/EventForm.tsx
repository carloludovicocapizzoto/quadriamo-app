// Nuovo evento o modifica: tipo, nome, importo e categoria (per i pagamenti che entrano nel budget), prima data,
// ripetizione (le più comuni con un nome, oppure "ogni N giorni/settimane/mesi/anni") e fine (mai, dopo N volte, in una data).
// Per gli abbonamenti: mentre scrivi il nome arrivano i servizi del catalogo (monogramma e ripetizione giusta), e come lo paghi.
import { useEffect, useRef, useState } from 'react'
import {
  EVENT_KINDS, KIND_SIDE, PAY_METHODS, REMINDER_DAYS, REMINDER_HOURS, REPEAT_PRESETS, presetOf, remainingCount, untilAfterCount,
  type CalEvent, type EventKind, type Reminder, type Repeat, type RepeatPreset,
} from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { AmountInput } from '../kit/AmountInput'
import { amountText, parseAmount } from '../kit/amount'
import { tap } from '../kit/motion'
import { categoryName } from '../names'
import { askNotifications } from '../notify/ask'
import { useStore } from '../../store/context'
import { searchServices, serviceById } from '../../content/services'
import { Monogram } from '../kit/Monogram'
import type { Settings } from '../../engine'

const k = (s: string) => s as keyof Dict
const PRESETS: (RepeatPreset | 'once' | 'custom')[] = ['once', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly', 'custom']
/** La categoria proposta per un tipo di pagamento (si può cambiare). */
const KIND_CATEGORY: Partial<Record<EventKind, string>> = { rent: 'rent', bill: 'fixedCosts', loan: 'loans', mortgage: 'loans', subscription: 'fixedCosts', tax: 'other',
  saving: 'safetyFundSaving', pac: 'investmentsSaving' }


export function EventForm({ event, settings, today, focusAmount, onSave, onDelete }: {
  event: CalEvent; settings: Settings; today: string; focusAmount?: boolean; onSave: (e: CalEvent) => void; onDelete?: () => void
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
  const { state } = useStore()
  const goals = (state.data?.goals ?? []).filter(g => !g.removed)
  const pacMonthly = state.data?.investments?.pac.monthly ?? 0
  // dal catalogo si arriva col nome già scelto: si scrive subito il prezzo (dopo l'apertura del foglio, che prende il focus)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusAmount) return
    const id = setTimeout(() => root.current?.querySelector<HTMLInputElement>('input[inputmode=decimal]')?.focus({ preventScroll: true }), 450)
    return () => clearTimeout(id)
  }, [focusAmount])
  // il tipo scelto resta visibile nella riga dei tipi, che scorre di lato
  useEffect(() => { root.current?.querySelector('.ev-kinds .chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [])
  // suggerimenti dal catalogo: solo per un abbonamento non ancora collegato a un servizio, mentre scrivi il nome
  const hints = e.kind === 'subscription' && !e.service && e.title.trim().length >= 2 ? searchServices(e.title, null, 4) : []

  const pickKind = (kind: EventKind) => {
    tap()
    const out = KIND_SIDE[kind] === 'out'
    // la categoria segue il tipo, a meno che tu non ne abbia scelta un'altra
    const chosen = e.category && KIND_SIDE[e.kind] === 'out' && e.category !== (KIND_CATEGORY[e.kind] ?? 'other')
    set({ kind, category: out ? (chosen ? e.category : KIND_CATEGORY[kind] ?? 'other') : null,
      repeat: kind === 'reminder' || kind === 'tax' ? null : e.repeat ?? { every: 1, unit: 'month' } })
    if (kind === 'reminder' || kind === 'tax') setPreset('once')
    // il PAC parte dalla cifra del piano in Investimenti, se non ne hai già scritta una
    if (kind === 'pac' && !amount && pacMonthly > 0) setAmount(amountText(pacMonthly, lang))
  }
  const has = (r: Reminder) => (e.reminders ?? []).some(x => JSON.stringify(x) === JSON.stringify(r))
  const toggleReminder = (r: Reminder) => {
    tap()
    set({ reminders: has(r) ? (e.reminders ?? []).filter(x => JSON.stringify(x) !== JSON.stringify(r)) : [...(e.reminders ?? []), r] })
  }
  const custom = (e.reminders ?? []).filter((r): r is { at: string } => 'at' in r)
  const pickPreset = (p: typeof preset) => {
    tap(); setPreset(p)
    set({ repeat: p === 'once' ? null : p === 'custom' ? e.repeat ?? { every: 1, unit: 'week' } : { ...REPEAT_PRESETS[p] } })
  }
  function save() {
    const value = parseAmount(amount, lang)
    if (!e.title.trim()) return setErr(t('ev.errTitle'))
    if (!e.date) return setErr(t('ev.errDate'))
    if (side === 'out' && e.category && !(value && value > 0)) return setErr(t('ev.errAmount'))
    const until = !e.repeat || end === 'never' ? null
      : end === 'count' ? untilAfterCount(e, Math.max(1, Number(count) || 1)) : e.until && e.until >= e.date ? e.until : null
    const reminders = (e.reminders ?? []).filter(r => !('hours' in r) || e.time)
    onSave({ ...e, title: e.title.trim().slice(0, 60), amount: value && value > 0 ? value : null,
      category: side === 'out' ? e.category : null, goalId: e.kind === 'saving' && e.goalId ? e.goalId : undefined,
      method: side === 'out' && e.method ? e.method : undefined, until, reminders, nag: reminders.length > 0 && !!e.nag })
    // il primo promemoria è il momento giusto per chiedere le notifiche (mai al primo avvio)
    if (reminders.length) askNotifications()
  }

  return (
    <div className="event-form" ref={root}>
      <div className="chips ev-kinds" role="radiogroup" aria-label={t('ev.kind')}>
        {EVENT_KINDS.map(kind => <button key={kind} type="button" role="radio" aria-checked={e.kind === kind}
          className={`chip${e.kind === kind ? ' on' : ''}`} onClick={() => pickKind(kind)}>{t(k(`ev.kind.${kind}`))}</button>)}
      </div>

      <div className="txs-rows">
        <label className="txs-row"><span>{t('ev.title')}</span>
          <span className="ev-name"><input value={e.title} maxLength={60} placeholder={t(k(`ev.ph.${e.kind}`))}
              onChange={x => set({ title: x.target.value, ...(e.service && x.target.value !== serviceById(e.service)?.name ? { service: null } : {}) })} />
            {e.service && <Monogram service={e.service} name={e.title} size={28} />}</span></label>
        {hints.length > 0 && <div className="ev-hints" role="listbox" aria-label={t('sub.search')}>
          {hints.map(h => <button key={h.id} type="button" role="option" aria-selected="false" className="ev-hint"
            onClick={() => { tap(); set({ title: h.name, service: h.id, repeat: h.yearly ? { every: 1, unit: 'year' } : e.repeat ?? { every: 1, unit: 'month' } }); setPreset(h.yearly ? 'yearly' : presetOf(e.repeat ?? { every: 1, unit: 'month' })) }}>
            <Monogram service={h.id} name={h.name} size={24} /><span>{h.name}</span></button>)}
        </div>}
        {side !== 'none' && <label className="txs-row"><span>{t('ev.amount')}</span>
          <AmountInput value={amount} onChange={setAmount} placeholder={t('ev.optional')} aria-label={t('ev.amount')} /></label>}
        {side === 'out' && <label className="txs-row"><span>{t('ev.category')}</span>
          <select value={e.category ?? ''} onChange={x => set({ category: x.target.value || null })}>
            {spending.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
            <option value="">{t('ev.noBudget')}</option>
          </select></label>}
        {e.kind === 'saving' && goals.length > 0 && <label className="txs-row"><span>{t('ev.goal')}</span>
          <select value={e.goalId ?? ''} onChange={x => set({ goalId: x.target.value || null })}>
            <option value="">{t('ev.goalEmergency')}</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select></label>}
        <label className="txs-row"><span>{e.repeat ? t('ev.first') : t('ev.date')}</span>
          <input type="date" value={e.date} onChange={x => set({ date: x.target.value || today })} /></label>
      </div>
      {side === 'out' && <p className="small muted">{e.category ? t('ev.inBudgetHint') : t('ev.noBudgetHint')}
        {e.kind === 'saving' && e.goalId ? ` ${t('ev.goalHint')}` : e.kind === 'pac' && pacMonthly > 0 ? ` ${t('ev.pacHint')}` : ''}</p>}
      {side === 'out' && <>
        <p className="small fb-q"><b>{t('pm.title')}</b></p>
        <div className="chips" role="radiogroup" aria-label={t('pm.title')}>
          {PAY_METHODS.map(m => <button key={m} type="button" role="radio" aria-checked={e.method === m} className={`chip${e.method === m ? ' on' : ''}`}
            onClick={() => { tap(); set({ method: e.method === m ? null : m }) }}>{t(k(`pm.${m}`))}</button>)}
        </div>
      </>}

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

      <p className="small fb-q"><b>{t('rem.title')}</b></p>
      <div className="chips" role="group" aria-label={t('rem.title')}>
        {REMINDER_DAYS.map(d => <button key={d} type="button" aria-pressed={has({ days: d })} className={`chip${has({ days: d }) ? ' on' : ''}`}
          onClick={() => toggleReminder({ days: d })}>{d === 0 ? t('rem.sameDay') : d === 1 ? t('rem.dayBefore') : t('rem.daysBefore', { n: d })}</button>)}
        {e.time && REMINDER_HOURS.map(h => <button key={`h${h}`} type="button" aria-pressed={has({ hours: h })} className={`chip${has({ hours: h }) ? ' on' : ''}`}
          onClick={() => toggleReminder({ hours: h })}>{h === 1 ? t('rem.hourBefore') : t('rem.hoursBefore', { n: h })}</button>)}
      </div>
      <div className="txs-rows">
        <label className="txs-row"><span>{t('rem.time')}</span>
          <input type="time" value={e.time ?? ''} onChange={x => set({ time: x.target.value || null })} aria-describedby="rem-time-hint" /></label>
        {custom.map((r, i) => <label key={i} className="txs-row"><span>{t('rem.at')}</span>
          <span className="ev-every"><input type="datetime-local" value={r.at} onChange={x => set({ reminders: (e.reminders ?? []).map(y => y === r ? { at: x.target.value } : y) })} />
            <button type="button" className="icon-btn" aria-label={t('rem.remove')} onClick={() => set({ reminders: (e.reminders ?? []).filter(y => y !== r) })}>×</button></span></label>)}
      </div>
      <p id="rem-time-hint" className="small muted">{t('rem.timeHint')}</p>
      <button type="button" className="link-btn ev-custom" onClick={() => { tap(); set({ reminders: [...(e.reminders ?? []), { at: `${e.date}T${e.time ?? '09:00'}` }] }) }}>+ {t('rem.addCustom')}</button>
      {(e.reminders ?? []).length > 0 && <label className="check wrap-text"><input type="checkbox" checked={!!e.nag} onChange={x => set({ nag: x.target.checked })} />
        <span>{t('rem.nag')}<br /><small className="muted">{t('rem.nagHint')}</small></span></label>}

      {err && <p className="small bad-text" role="alert">{err}</p>}
      <button className="btn primary wide top-gap" onClick={save}>{onDelete ? t('action.save') : t('ev.create')}</button>
      {onDelete && <button className="link-btn danger-link" onClick={() => { if (confirm(t('ev.confirmDelete'))) onDelete() }}>{t('ev.delete')}</button>}
    </div>
  )
}
