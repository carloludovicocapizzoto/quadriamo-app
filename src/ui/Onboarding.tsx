import { useI18n } from '../i18n/core'
import { useSync } from '../sync/context'
import { setupPending } from '../sync/profile'
import { InstallButton } from './InstallButton'
import { LegalLinks } from './LegalLinks'
import { Icon } from './Icon'
import { guessCurrency } from './names'

/** Dopo l'accesso, senza dati su questo dispositivo (o senza il server, in sviluppo). Le impostazioni arrivano dopo, come passaggi (SetupWizard). */
export function Onboarding({ onStart, onDemo }: { onStart: (currency: string, startDay: number) => void; onDemo: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const start = () => { setupPending.set(); onStart(guessCurrency(), 1) }

  // con l'account ma senza dati su questo dispositivo: o arrivano dal server, o si configura un budget nuovo
  if (sync.user) {
    return (
      <section className="card onboarding">
        <h1>{sync.user.firstName ? t('auth.hello', { name: sync.user.firstName }) : t('onb.title')}</h1>
        <p className="lead">{sync.status === 'syncing' ? t('sync.syncing') : t('setup.intro')}</p>
        <button className="btn primary big-btn" onClick={start}>{t('setup.title')}<Icon name="chevron" size={16} /></button>
      </section>
    )
  }

  return (
    <section className="card onboarding">
      <h1>{t('onb.title')}</h1>
      <p className="lead">{t('onb.text')}</p>
      <p className="muted small"><Icon name="lock" size={14} />{t('onb.privacy')}</p>
      <div className="stack">
        <button className="btn primary big-btn" onClick={start}>{t('onb.start')}<Icon name="chevron" size={16} /></button>
        <button className="btn" onClick={onDemo}>{t('onb.demo')}</button>
      </div>
      <InstallButton />
      <LegalLinks notice />
    </section>
  )
}
