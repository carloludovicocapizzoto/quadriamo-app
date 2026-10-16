import { useState, type FormEvent } from 'react'
import { isStandalone } from '../beta/device'
import { SPLIT, applyPersona, daysBetween, defaultPolicy, mainIncome, monthOf, periodOf, todayIso, updateCapital, type CapitalKind, type Persona } from '../engine'
import { useStore } from '../store/context'
import { newId } from '../store/state'
import { parseAmount } from './kit/amount'
import { BUCKET_COLORS, bucketName } from './names'
import { enablePush, pushSupported } from '../beta/push'
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

type Kind = { kind: 'persona' } | { kind: 'notify' } | { kind: 'salary' } | { kind: 'capital' } | { kind: 'recurring' } | { kind: 'settings'; section: SettingsSection; title: keyof Dict } | { kind: 'profile' }
const isDesktopApp = () => 'quadriamoDesktop' in window || /QuadriamoDesktop\//.test(navigator.userAgent)

/**
 * Configurazione a passaggi dopo la registrazione (o senza il server, in sviluppo). Con l'account, il primo passaggio chiede
 * subito di attivare le notifiche (dove il dispositivo le supporta) e l'ultimo è il profilo facoltativo.
 */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const [step, setStep] = useState(1)
  const [ready, setReady] = useState(false)
  // fine della configurazione: un attimo di "Tutto pronto!", poi si entra nell'app
  const finish = () => { setReady(true); window.scrollTo(0, 0); setTimeout(onDone, 1600) }
  const [canNotify] = useState(() => !!sync.user && pushSupported() && !isDesktopApp() && (isStandalone() || !/iPhone|iPad|iPod/.test(navigator.userAgent)))
  const { state } = useStore()
  const student = state.data?.settings.persona === 'student'
  const steps: Kind[] = [
    { kind: 'persona' },
    ...(canNotify ? [{ kind: 'notify' } as Kind] : []),
    // subito dopo valuta e giorno: lo stipendio, per vedere il proprio numero del giorno prima ancora di registrare una spesa
    ...STEPS.flatMap(([section, title]) => section === 'general'
      ? [{ kind: 'settings', section, title } as Kind, { kind: 'salary' } as Kind, { kind: 'capital' } as Kind]
      // dopo le categorie, i pagamenti che si ripetono (affitto, bollette, abbonamenti): gli stessi del calendario
      : section === 'categories' ? [{ kind: 'settings', section, title } as Kind, { kind: 'recurring' } as Kind]
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
  const title = cur.kind === 'persona' ? t('setup.personaTitle') : cur.kind === 'notify' ? t('setup.notifyTitle')
    : cur.kind === 'salary' ? t(student ? 'setup.incomeTitle' : 'setup.salaryTitle')
    : cur.kind === 'capital' ? t('setup.capitalTitle')
    : cur.kind === 'recurring' ? t('settings.recurring')
    : cur.kind === 'profile' ? t('setup.profile') : t(cur.title)
  return (
    <section className="card wizard">
      <StepHeader n={step} total={total} title={title} />
      <div className="step-body" key={step}>
        {cur.kind === 'persona' && <PersonaStep onPick={() => { window.scrollTo(0, 0); setStep(step + 1) }} />}
        {cur.kind === 'notify' && <NotifyStep />}
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

/** Primo passaggio dopo la registrazione: il pulsante apre subito l'avviso del sistema per consentire le notifiche. */
function NotifyStep() {
  const { t, lang } = useI18n()
  const [state, setState] = useState<'idle' | 'busy' | 'on' | 'denied'>(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'on' : 'idle')
  async function ask() {
    setState('busy')
    try { setState((await enablePush(lang)) ? 'on' : 'denied') } catch { setState('denied') }
  }
  return (
    <div className="notify-step">
      <div className="notify-bell" aria-hidden="true"><Icon name="bell" size={30} /></div>
      <p>{t('setup.notifyText')}</p>
      {state === 'on'
        ? <p className="good-text"><b><Icon name="check" size={16} />{t('setup.notifyOn')}</b></p>
        : <button type="button" className="btn primary big-btn" disabled={state === 'busy'} onClick={() => void ask()}><Icon name="bell" size={18} />{t('setup.notifyBtn')}</button>}
      {state === 'denied' && <p className="small muted">{t('setup.notifyDenied')}</p>}
      <p className="small muted">{t('setup.notifyHint')}</p>
    </div>
  )
}

/** "Il tuo stipendio": scrivi quanto ti entra e vedi subito le quattro parti e quanto puoi spendere al giorno. */
function SalaryStep() {
  const { t, money, lang } = useI18n()
  const { state, dispatch } = useStore()
  const data = state.data!
  const today = todayIso()
  const period = periodOf(monthOf(today, data.settings.monthStartDay), data.settings.monthStartDay)
  const income = mainIncome(data.settings)
  const student = data.settings.persona === 'student'
  const already = data.transactions.find(x => x.category === income && x.date && x.date >= period.start && x.date <= period.end)
  const rentName = t('setup.rentName')
  const rent = data.settings.events.find(x => x.id === 'setup-rent')
  const [rentRaw, setRentRaw] = useState(rent ? amountText(rent.amount, lang) : '')
  const saveRent = (v: string) => {
    setRentRaw(v)
    const n = parseAmount(v)
    const others = data.settings.events.filter(x => x !== rent)
    // l'affitto è un evento del calendario: ogni mese dal primo giorno del periodo, prima delle quattro parti
    const events = n && n > 0 ? [...others, { id: 'setup-rent', kind: 'rent' as const, title: rentName, amount: n, category: 'rent', date: period.start,
      repeat: { every: 1, unit: 'month' as const }, until: null, done: [], active: true }] : others
    dispatch({ type: 'setSettings', settings: { ...data.settings, events } })
  }
  const [raw, setRaw] = useState(already?.amount ? amountText(already.amount, lang) : '')
  const amount = parseAmount(raw) ?? 0
  const days = Math.max(1, daysBetween(today, period.end) + 1)
  const cur = data.settings.currency
  const save = (v: string) => {
    setRaw(v)
    const n = parseAmount(v)
    if (!n || n <= 0) { if (already) dispatch({ type: 'deleteTx', id: already.id }); return }
    const tx = { id: already?.id ?? newId(), date: already?.date ?? today, description: t(`c.${income}` as keyof Dict), category: income, amount: n, paidFrom: SPLIT }
    dispatch({ type: already ? 'updateTx' : 'addTx', tx })
  }
  return (
    <div className="salary-step">
      <p>{t(student ? 'setup.studentText' : 'setup.salaryText')}</p>
      <label className="field"><span>{t(student ? 'setup.studentLabel' : 'setup.salaryLabel')} ({cur})</span>
        <AmountInput className="salary-input" placeholder={student ? '900' : '1.600'} value={raw} onChange={save} autoFocus /></label>
      {student && <label className="field"><span>{t('setup.rentLabel')} ({cur})</span>
        <AmountInput placeholder="380" value={rentRaw} onChange={saveRent} />
        <small className="muted">{t('setup.rentHint')}</small></label>}
      {amount > 0 && (
        <div className="salary-preview" key={Math.round(amount)}>
          <ul>
            {data.settings.buckets.map((b, i) => (
              <li key={b.id}><i style={{ background: BUCKET_COLORS[i] }} /><span>{bucketName(b, t)}</span>
                <b>{money(amount * b.share, cur)}</b></li>
            ))}
          </ul>
          <div className="salary-today">
            <span className="muted small">{t('setup.salaryToday')}</span>
            {data.settings.buckets.slice(0, 2).map((b, i) => (
              <div key={b.id} className="salary-day"><span className="small"><i style={{ background: BUCKET_COLORS[i] }} />{bucketName(b, t)}</span>
                <strong>{t('safe.perDay', { amount: money((amount * b.share) / days, cur) })}</strong></div>
            ))}
            <span className="muted small">{t('setup.salaryHint', { days })}</span>
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
