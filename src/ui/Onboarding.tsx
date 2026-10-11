import { useState } from 'react'
import { useI18n } from '../i18n/core'
import { useSync } from '../sync/context'
import { setupPending } from '../sync/profile'
import { LoginScreen } from './AccountSection'
import { InstallButton } from './InstallButton'
import { LegalLinks } from './LegalLinks'
import { guessCurrency } from './names'

/** Primo avvio: solo accesso / creazione account. Le impostazioni arrivano dopo, come passaggi (SetupWizard). */
export function Onboarding({ onStart, onDemo }: { onStart: (currency: string, startDay: number) => void; onDemo: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const [local, setLocal] = useState(false)
  const start = () => { setupPending.set(); onStart(guessCurrency(), 1) }

  // con l'account ma senza dati su questo dispositivo: o arrivano dal server, o si configura un budget nuovo
  if (sync.user) {
    return (
      <section className="card onboarding">
        <h1>{sync.user.firstName ? t('auth.hello', { name: sync.user.firstName }) : t('onb.title')}</h1>
        <p className="lead">{sync.status === 'syncing' ? t('sync.syncing') : t('setup.intro')}</p>
        <button className="btn primary big-btn" onClick={start}>{t('setup.title')} →</button>
      </section>
    )
  }

  if (!sync.enabled || local) {
    return (
      <section className="card onboarding">
        <h1>{t('onb.title')}</h1>
        <p className="lead">{t('onb.text')}</p>
        <p className="muted small">🔒 {t('onb.privacy')}</p>
        <div className="stack">
          <button className="btn primary big-btn" onClick={start}>{t('onb.start')} →</button>
          <button className="btn" onClick={onDemo}>{t('onb.demo')}</button>
        </div>
        {sync.enabled && <button className="link-btn top-gap" onClick={() => setLocal(false)}>👤 {t('onb.account')}</button>}
        <InstallButton />
        <LegalLinks notice />
      </section>
    )
  }

  return (
    <LoginScreen footer={<>
      <button className="link-btn" onClick={() => setLocal(true)}>{t('onb.noAccount')} →</button>
      <small className="muted">{t('onb.noAccountHint')}</small>
      <LegalLinks notice />
    </>} />
  )
}
