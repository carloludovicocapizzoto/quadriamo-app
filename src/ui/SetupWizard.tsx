import { useState, type FormEvent } from 'react'
import { isStandalone } from '../beta/device'
import { enablePush, pushSupported } from '../beta/push'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useSync } from '../sync/context'
import { ProfileForm } from './ProfileForm'
import { SettingsView, type SettingsSection } from './SettingsView'
import { StepHeader, StepNav } from './Steps'

// configurazione iniziale: ogni sezione delle Impostazioni è un passaggio, nell'ordine in cui serve
const STEPS: [SettingsSection, keyof Dict][] = [
  ['general', 'settings.general'], ['rule', 'settings.rule'], ['categories', 'settings.categories'],
  ['recurring', 'settings.recurring'], ['rules', 'rules.title'], ['fx', 'settings.fx'], ['data', 'settings.data'],
]

type Kind = { kind: 'notify' } | { kind: 'settings'; section: SettingsSection; title: keyof Dict } | { kind: 'profile' }
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
  const steps: Kind[] = [
    ...(canNotify ? [{ kind: 'notify' } as Kind] : []),
    ...STEPS.map(([section, title]) => ({ kind: 'settings', section, title }) as Kind),
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
  const title = cur.kind === 'notify' ? t('setup.notifyTitle') : cur.kind === 'profile' ? t('setup.profile') : t(cur.title)
  return (
    <section className="card wizard">
      <h1>{t('setup.title')}</h1>
      {step === 1 && <p className="muted small">{t('setup.intro')}</p>}
      <StepHeader n={step} total={total} title={title} />
      <div className="step-body" key={step}>
        {cur.kind === 'notify' && <NotifyStep />}
        {cur.kind === 'settings' && <SettingsView only={[cur.section]} wizard />}
        {cur.kind === 'profile' && <ProfileForm withShares={false} onDone={finish} />}
      </div>
      {cur.kind !== 'profile' && (
        <form onSubmit={next}>
          <StepNav onBack={step > 1 ? () => setStep(step - 1) : undefined}
            next={step < total ? `${t('step.next')} →` : t('setup.finish')}
            extra={<button type="button" className="link-btn" onClick={finish}>{t('setup.skip')}</button>} />
        </form>
      )}
    </section>
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
      <div className="notify-bell" aria-hidden="true">🔔</div>
      <p>{t('setup.notifyText')}</p>
      {state === 'on'
        ? <p className="good-text"><b>✓ {t('setup.notifyOn')}</b></p>
        : <button type="button" className="btn primary big-btn" disabled={state === 'busy'} onClick={() => void ask()}>🔔 {t('setup.notifyBtn')}</button>}
      {state === 'denied' && <p className="small muted">{t('setup.notifyDenied')}</p>}
      <p className="small muted">{t('setup.notifyHint')}</p>
    </div>
  )
}
