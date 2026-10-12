import { useEffect, useState } from 'react'
import { setStatsConsent, statsConsent } from '../../beta/device'
import { track } from '../../beta/telemetry'
import { useI18n } from '../../i18n/core'
import { supabase } from '../../sync/client'
import { useSync } from '../../sync/context'
import { Icon } from '../Icon'
import { PushToggle } from './PushToggle'

const SITE = 'https://carloludovicocapizzoto.github.io/quadriamo-app/'

/** Impostazioni → Beta: invita un amico, feedback, notifiche, statistiche, accesso alla dashboard. */
export function BetaSection({ onFeedback, onAdmin }: { onFeedback: () => void; onAdmin: () => void }) {
  const { t, lang } = useI18n()
  const sync = useSync()
  const [stats, setStats] = useState(statsConsent() === 'yes')
  const [note, setNote] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!supabase || !sync.user) return
    void supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true))
  }, [sync.user])
  if (!supabase) return null

  async function invite() {
    const url = `${SITE}?lang=${lang}`
    const text = t('beta.inviteText')
    try {
      if (navigator.share) await navigator.share({ title: 'Quadriamo', text, url })
      else { await navigator.clipboard.writeText(`${text} ${url}`); setNote(t('beta.copied')) }
      void track('share')
    } catch { /* condivisione annullata */ }
  }
  return (
    <section className="card">
      <h3 className="h-plain">{t('beta.section')}</h3>
      <div className="btn-pair">
        <button className="btn" onClick={invite}><Icon name="share" size={16} />{t('beta.invite')}</button>
        <button className="btn" onClick={onFeedback}><Icon name="message" size={16} />{t('beta.feedback')}</button>
      </div>
      {note && <p className="small good-text">✓ {note}</p>}
      <div className="top-gap"><PushToggle /></div>
      <label className="check top-gap">
        <input type="checkbox" checked={stats} onChange={e => { setStats(e.target.checked); setStatsConsent(e.target.checked ? 'yes' : 'no') }} />
        {t('beta.stats')}
      </label>
      <p className="small muted">{t('beta.statsHint')}</p>
      {isAdmin && <button className="btn top-gap" onClick={onAdmin}>📊 {t('admin.open')}</button>}
    </section>
  )
}
