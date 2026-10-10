import { useEffect, useState } from 'react'
import { isStandalone, platform } from '../../beta/device'
import { disablePush, enablePush, pushEnabled, pushSupported } from '../../beta/push'
import { useI18n } from '../../i18n/core'

/** Attiva o disattiva il promemoria push (feedback ogni 10 giorni). */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { void pushEnabled().then(setOn) }, [])

  const iosNotInstalled = platform() === 'ios' && !isStandalone()
  if (!pushSupported() && !iosNotInstalled) return null
  if (iosNotInstalled) return <p className="small muted">🔔 {t('push.iosHint')}</p>
  if (on === null || (compact && on)) return null

  async function toggle() {
    setBusy(true); setNote('')
    try {
      if (on) { await disablePush(); setOn(false) }
      else if (await enablePush(lang)) setOn(true)
      else setNote(t('push.denied'))
    } catch { setNote(t('fb.error')) } finally { setBusy(false) }
  }
  return (
    <div className="push-toggle">
      {compact && <p className="small">{t('push.offer')}</p>}
      <button className={`btn small-btn${on ? '' : ' primary'}`} disabled={busy} onClick={toggle}>
        🔔 {on ? t('push.off') : t('push.enable')}</button>
      {on && !compact && <span className="small good-text"> ✓ {t('push.on')}</span>}
      {note && <p className="small bad-text">{note}</p>}
    </div>
  )
}
