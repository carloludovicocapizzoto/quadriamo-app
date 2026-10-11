import { useState, type FormEvent } from 'react'
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

/** Configurazione a passaggi dopo la registrazione (o "continua senza account"); ultimo passaggio il profilo, se hai un account. */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const [step, setStep] = useState(1)
  const [ready, setReady] = useState(false)
  // fine della configurazione: un attimo di "Tutto pronto!", poi si entra nell'app
  const finish = () => { setReady(true); window.scrollTo(0, 0); setTimeout(onDone, 1600) }
  const total = STEPS.length + (sync.user ? 1 : 0)
  const isProfile = step > STEPS.length
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
  return (
    <section className="card wizard">
      <h1>{t('setup.title')}</h1>
      {step === 1 && <p className="muted small">{t('setup.intro')}</p>}
      <StepHeader n={step} total={total} title={isProfile ? t('setup.profile') : t(STEPS[step - 1][1])} />
      <div className="step-body" key={step}>
        {isProfile ? <ProfileForm withShares={false} onDone={finish} />
          : <SettingsView only={[STEPS[step - 1][0]]} wizard />}
      </div>
      {!isProfile && (
        <form onSubmit={next}>
          <StepNav onBack={step > 1 ? () => setStep(step - 1) : undefined}
            next={step < total ? `${t('step.next')} →` : t('setup.finish')}
            extra={<button type="button" className="link-btn" onClick={finish}>{t('setup.skip')}</button>} />
        </form>
      )}
    </section>
  )
}
