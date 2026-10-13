import { useState, type FormEvent } from 'react'
import { isStandalone } from '../beta/device'
import { SPLIT, applyPersona, daysBetween, mainIncome, monthOf, periodOf, todayIso, type Persona } from '../engine'
import { useStore } from '../store/context'
import { newId, parseAmount } from '../store/state'
import { BUCKET_COLORS, bucketName } from './names'
import { enablePush, pushSupported } from '../beta/push'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useSync } from '../sync/context'
import { ProfileForm } from './ProfileForm'
import { SettingsView, type SettingsSection } from './SettingsView'
import { Icon } from './Icon'
import { StepHeader, StepNav } from './Steps'
import { AmountInput } from './kit/AmountInput'
import { amountText } from './kit/amount'

// configurazione iniziale: ogni sezione delle Impostazioni è un passaggio, nell'ordine in cui serve
const STEPS: [SettingsSection, keyof Dict][] = [
  ['general', 'settings.general'], ['rule', 'settings.rule'], ['categories', 'settings.categories'],
  ['recurring', 'settings.recurring'], ['rules', 'rules.title'], ['fx', 'settings.fx'], ['data', 'settings.data'],
]

type Kind = { kind: 'persona' } | { kind: 'notify' } | { kind: 'salary' } | { kind: 'settings'; section: SettingsSection; title: keyof Dict } | { kind: 'profile' }
const isDesktopApp = () => 'quadriamoDesktop' in window || /QuadriamoDesktop\//.test(navigator.userAgent)

/**
 * Configurazione a passaggi dopo la registrazione (o "continua senza account"). Con l'account, il primo passaggio chiede
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
      ? [{ kind: 'settings', section, title } as Kind, { kind: 'salary' } as Kind]
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
    : cur.kind === 'profile' ? t('setup.profile') : t(cur.title)
  return (
    <section className="card wizard">
      <StepHeader n={step} total={total} title={title} />
      <div className="step-body" key={step}>
        {cur.kind === 'persona' && <PersonaStep onPick={() => { window.scrollTo(0, 0); setStep(step + 1) }} />}
        {cur.kind === 'notify' && <NotifyStep />}
        {cur.kind === 'settings' && <SettingsView only={[cur.section]} wizard />}
        {cur.kind === 'salary' && <SalaryStep />}
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
  const rent = data.settings.recurring.find(x => x.name === rentName && x.category === 'rent')
  const [rentRaw, setRentRaw] = useState(rent ? amountText(rent.amount, lang) : '')
  const saveRent = (v: string) => {
    setRentRaw(v)
    const n = parseAmount(v)
    const others = data.settings.recurring.filter(x => x !== rent)
    const recurring = n && n > 0 ? [...others, { name: rentName, amount: n, category: 'rent', day: 1, active: true }] : others
    dispatch({ type: 'setSettings', settings: { ...data.settings, recurring } })
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
