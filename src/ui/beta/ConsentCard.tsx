import { useState } from 'react'
import { setStatsConsent, statsConsent } from '../../beta/device'
import { useI18n } from '../../i18n/core'
import { supabase } from '../../sync/client'

/** Chiede una sola volta il consenso alle statistiche anonime della beta. */
export function ConsentCard({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  const { t } = useI18n()
  const [asked, setAsked] = useState(statsConsent() !== null)
  if (!supabase || asked) return null
  const answer = (yes: boolean) => { setStatsConsent(yes ? 'yes' : 'no'); setAsked(true); onAnswer(yes) }
  return (
    <section className="card consent" role="region" aria-label={t('beta.consentTitle')}>
      <h3 className="h-plain">{t('beta.consentTitle')}</h3>
      <p className="small muted">{t('beta.consentText')}</p>
      <div className="stack-row">
        <button className="btn primary small-btn" onClick={() => answer(true)}>{t('beta.yes')}</button>
        <button className="btn small-btn" onClick={() => answer(false)}>{t('beta.no')}</button>
      </div>
    </section>
  )
}
