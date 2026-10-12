import { useState } from 'react'
import { morningWanted, setMorning } from '../../beta/morning'
import { pushSupported } from '../../beta/push'
import { useI18n } from '../../i18n/core'

/** Notifica del mattino "Oggi puoi spendere…" (attiva di partenza insieme alle notifiche). */
export function MorningToggle() {
  const { t } = useI18n()
  const [on, setOn] = useState(morningWanted)
  if (!pushSupported()) return null
  return (
    <div className="morning-toggle">
      <label className="check wrap-text">
        <input type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); void setMorning(e.target.checked) }} />
        <span><b>☀️ {t('push.morning')}</b><br /><span className="small muted">{t('push.morningHint')}</span></span>
      </label>
    </div>
  )
}
