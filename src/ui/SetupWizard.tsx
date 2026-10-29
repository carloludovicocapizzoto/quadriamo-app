import { useState, type FormEvent } from 'react'
import { applyPersona, computeMonth, splitBalance, defaultPolicy, monthOf, nextMonth, periodOf, todayBudget, todayIso, updateCapital, ymKey, type CapitalKind, type Persona, type Settings } from '../engine'
import { useStore } from '../store/context'
import { newId } from '../store/state'
import { parseAmount } from './kit/amount'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useSync } from '../sync/context'
import { ProfileForm } from './ProfileForm'
import { SettingsView, type SettingsSection } from './settings/SettingsView'
import { Icon } from './Icon'
import { StepHeader, StepNav } from './Steps'
import { AmountInput } from './kit/AmountInput'
import { amountText } from './kit/amount'
import { RecurringList } from './calendar/RecurringList'

// configurazione iniziale: ogni sezione delle Impostazioni è un passaggio, nell'ordine in cui serve
const STEPS: [SettingsSection, keyof Dict][] = [
  ['general', 'settings.general'], ['rule', 'settings.rule'], ['categories', 'settings.categories'],
  ['rules', 'rules.title'], ['fx', 'settings.fx'], ['data', 'settings.data'],
]

type Kind = { kind: 'persona' } | { kind: 'salary' } | { kind: 'capital' } | { kind: 'recurring' } | { kind: 'settings'; section: SettingsSection; title: keyof Dict } | { kind: 'profile' }

/**
 * Configurazione a passaggi dopo la registrazione (o senza il server, in sviluppo); con l'account l'ultimo è il profilo facoltativo.
 * Le notifiche non si chiedono qui: arrivano con il primo promemoria del calendario (ui/notify/ask), quando servono davvero.
 */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const [step, setStep] = useState(1)
  const [ready, setReady] = useState(false)
  // fine della configurazione: un attimo di "Tutto pronto!", poi si entra nell'app
  const finish = () => { setReady(true); window.scrollTo(0, 0); setTimeout(onDone, 1600) }
  const { state } = useStore()
  const student = state.data?.settings.persona === 'student'
  const steps: Kind[] = [
    { kind: 'persona' },
    // l'ordine del piano del mese: quanto prendi e quando, quanto hai oggi; poi la regola, le spese fisse, il capitale
    ...STEPS.flatMap(([section, title]) => section === 'general'
      ? [{ kind: 'settings', section, title } as Kind, { kind: 'salary' } as Kind]
      // dopo le categorie, i pagamenti che si ripetono (affitto, bollette, abbonamenti): gli stessi del calendario
      : section === 'categories' ? [{ kind: 'settings', section, title } as Kind, { kind: 'recurring' } as Kind, { kind: 'capital' } as Kind]
      : [{ kind: 'settings', section, title } as Kind]),
    ...(sync.user ? [{ kind: 'profile' } as Kind] : []),
  ]
  const total = steps.length
  const cur = steps[step - 1]
  const next = (e: FormEvent) => {
    e.preventDefault()
    window.scrollTo(0, 0)
    if (step < total) setStep(step + 1); else finish()
  }
  if (ready) {
    return (
      <section className="ready" role="status">
        <div className="ready-check"><svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><path d="M13 25l7 7 15-16" /></svg></div>
        <h2>{t('setup.ready')}</h2>
        <p>{t('setup.readySub')}</p>
      </section>
    )
  }
  const title = cur.kind === 'persona' ? t('setup.personaTitle')
    : cur.kind === 'salary' ? t(student ? 'setup.incomeTitle' : 'setup.salaryTitle')
    : cur.kind === 'capital' ? t('setup.capitalTitle')
    : cur.kind === 'recurring' ? t('settings.recurring')
    : cur.kind === 'profile' ? t('setup.profile') : t(cur.title)
  return (
    <section className="card wizard">
      <StepHeader n={step} total={total} title={title} />
      <div className="step-body" key={step}>
        {cur.kind === 'persona' && <PersonaStep onPick={() => { window.scrollTo(0, 0); setStep(step + 1) }} />}
        {cur.kind === 'settings' && <SettingsView only={[cur.section]} wizard />}
        {cur.kind === 'recurring' && <RecurringList />}
        {cur.kind === 'salary' && <SalaryStep />}
        {cur.kind === 'capital' && <CapitalStep />}
        {cur.kind === 'profile' && <ProfileForm withShares={false} onDone={finish} />}
      </div>
      {cur.kind !== 'profile' && (
        <form onSubmit={next}>
          <StepNav onBack={step > 1 ? () => setStep(step - 1) : undefined}
            next={step < total ? `${t('step.next')}` : t('setup.finish')}
            extra={<button type="button" className="link-btn" onClick={finish}>{t('setup.skip')}</button>} />
        </form>
      )}
    </section>
  )
}

/** "Chi sei?": lo studente fuori sede parte con regola e categorie pensate per lui (si cambiano quando vuoi). */
function PersonaStep({ onPick }: { onPick: () => void }) {
  const { t } = useI18n()
  const { state, dispatch } = useStore()
  const cur = state.data?.settings.persona
  const pick = (p: Persona) => {
    dispatch({ type: 'setSettings', settings: applyPersona(state.data!.settings, p) })
    setTimeout(onPick, 180)
  }
  const opts: { p: Persona }[] = [{ p: 'student' }, { p: 'worker' }, { p: 'other' }]
  return (
    <div className="persona">
      <p className="muted">{t('setup.personaText')}</p>
      <ul className="group-list">{opts.map(o => (
        <li key={o.p}><button type="button" className={`row persona-row${cur === o.p ? ' on' : ''}`} onClick={() => pick(o.p)} aria-pressed={cur === o.p}>
          <span className="row-main"><span>{t(`persona.${o.p}` as keyof Dict)}</span><small>{t(`persona.${o.p}D` as keyof Dict)}</small></span>
          <Icon name={cur === o.p ? 'check' : 'chevron'} size={18} className="row-chev" />
        </button></li>
      ))}</ul>
    </div>
  )
}

/**
 * Il piano del mese: quanto prendi di norma (la base del numero del giorno, non un'entrata), quando arriva (l'inizio del
 * mese), se quello di questo periodo è già arrivato e quanto hai oggi (il saldo di partenza, diviso con la regola).
 */
function SalaryStep() {
  const { t, money, lang } = useI18n()
  const { state, dispatch } = useStore()
  const data = state.data!
  const settings = data.settings
  const today = todayIso()
  const student = settings.persona === 'student'
  const cur = settings.currency
  const [raw, setRaw] = useState(settings.expectedIncome ? amountText(settings.expectedIncome, lang) : '')
  const [day, setDay] = useState(settings.monthStartDay)
  const ym = monthOf(today, settings.monthStartDay)
  const [arrived, setArrived] = useState(!!settings.expectedFrom && settings.expectedFrom > ymKey(ym))
  const [balanceRaw, setBalanceRaw] = useState(() => {
    const n = settings.buckets.reduce((a, b) => a + b.startingBalance, 0)
    return n ? amountText(Math.round(n * 100) / 100, lang) : ''
  })
  // ogni risposta ricalcola tutto il piano: periodo, da quando vale il previsto, saldo di partenza nelle parti
  const apply = (next: { raw?: string; day?: number; arrived?: boolean; balanceRaw?: string }, base: Settings = settings) => {
    const income = parseAmount(next.raw ?? raw, lang)
    const startDay = Math.min(28, Math.max(1, next.day ?? day))
    const period = monthOf(today, startDay)
    const balance = Math.max(0, parseAmount(next.balanceRaw ?? balanceRaw, lang) ?? 0)
    dispatch({ type: 'setSettings', settings: {
      ...base, monthStartDay: startDay, firstMonth: period, balanceDate: balance > 0 ? today : null,
      expectedIncome: income && income > 0 ? income : null,
      expectedFrom: (next.arrived ?? arrived) ? ymKey(nextMonth(period)) : null,
      buckets: splitBalance(base.buckets, balance),
    } })
  }
  const rentName = t('setup.rentName')
  const rent = settings.events.find(x => x.id === 'setup-rent')
  const [rentRaw, setRentRaw] = useState(rent ? amountText(rent.amount, lang) : '')
  const saveRent = (v: string) => {
    setRentRaw(v)
    const n = parseAmount(v, lang)
    const others = settings.events.filter(x => x !== rent)
    const period = periodOf(ym, settings.monthStartDay)
    // l'affitto è un evento del calendario: ogni mese dal primo giorno del periodo, prima delle quattro parti
    const events = n && n > 0 ? [...others, { id: 'setup-rent', kind: 'rent' as const, title: rentName, amount: n, category: 'rent', date: period.start,
      repeat: { every: 1, unit: 'month' as const }, until: null, done: [], active: true }] : others
    dispatch({ type: 'setSettings', settings: { ...settings, events } })
  }
  // l'anteprima con gli stessi conti dell'app: il numero del giorno di oggi
  const preview = todayBudget(computeMonth(ym, data.transactions, settings, today), settings, today)
  const ready = !!settings.expectedIncome || settings.buckets.some(b => b.startingBalance > 0)
  return (
    <div className="salary-step">
      <p>{t(student ? 'setup.studentText' : 'setup.salaryText')}</p>
      <label className="field"><span>{t(student ? 'setup.studentLabel' : 'setup.salaryLabel')} ({cur})</span>
        <AmountInput className="salary-input" placeholder={student ? '900' : '1.600'} value={raw} onChange={v => { setRaw(v); apply({ raw: v }) }} autoFocus /></label>
      <label className="field"><span>{t('setup.payday')}</span>
        <input className="salary-day-input" type="number" inputMode="numeric" min={1} max={28} value={day}
               onChange={e => { const n = Number(e.target.value); setDay(n); if (n >= 1 && n <= 28) apply({ day: n }) }} />
        <small className="muted">{t('setup.paydayHint')}</small></label>
      <div className="field"><span>{t('setup.arrived')}</span>
        <div className="chips" role="radiogroup" aria-label={t('setup.arrived')}>
          {[false, true].map(v => <button key={String(v)} type="button" role="radio" aria-checked={arrived === v} className={`chip${arrived === v ? ' on' : ''}`}
            onClick={() => { setArrived(v); apply({ arrived: v }) }}>{t(v ? 'setup.arrivedYes' : 'setup.arrivedNo')}</button>)}
        </div>
        <small className="muted">{t(arrived ? 'setup.arrivedYesHint' : 'setup.arrivedNoHint')}</small></div>
      <label className="field"><span>{t('setup.balance')} ({cur})</span>
        <AmountInput className="setup-balance" placeholder="0" value={balanceRaw} onChange={v => { setBalanceRaw(v); apply({ balanceRaw: v }) }} />
        <small className="muted">{t('setup.balanceHint')}</small></label>
      {student && <label className="field"><span>{t('setup.rentLabel')} ({cur})</span>
        <AmountInput placeholder="380" value={rentRaw} onChange={saveRent} />
        <small className="muted">{t('setup.rentHint')}</small></label>}
      {ready && (
        <div className="salary-preview">
          <div className="salary-today">
            <span className="muted small">{t('setup.salaryToday')}</span>
            <strong>{t('safe.perDay', { amount: money(preview.left, cur) })}</strong>
            <span className="muted small">{t('setup.salaryHint')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Facoltativo: i risparmi che ci sono già (capitale iniziale). Una destinazione sola; le altre si aggiungono dal Profilo. */
function CapitalStep() {
  const { t } = useI18n()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const first = settings.capital?.parts[0]
  const [kind, setKind] = useState<CapitalKind>(first?.kind ?? 'emergency')
  const save = (amount: number | null, k: CapitalKind) => {
    const today = todayIso()
    const capital = amount && amount > 0
      ? updateCapital({ date: today, parts: [], history: [] }, [{ id: first?.id ?? newId(), name: t(`cap.kind.${k}` as keyof Dict), kind: k, amount, policy: defaultPolicy(k) }], today)
      : null
    dispatch({ type: 'setSettings', settings: { ...settings, capital } })
  }
  return <>
    <p className="lead">{t('setup.capitalText')}</p>
    <div className="txs-rows">
      <label className="txs-row"><span>{t('cap.amount')}</span><AmountInput defaultValue={first?.amount ?? null} placeholder="0" onValue={n => save(n, kind)} /></label>
      <label className="txs-row"><span>{t('cap.kind')}</span>
        <select value={kind} onChange={e => { const k = e.target.value as CapitalKind; setKind(k); if (first) save(first.amount, k) }}>
          {(['emergency', 'liquid', 'grow', 'spendable'] as CapitalKind[]).map(x => <option key={x} value={x}>{t(`cap.kind.${x}` as keyof Dict)}</option>)}
        </select></label>
    </div>
    <p className="small muted txs-hint">{t('setup.capitalHint')}</p>
  </>
}
