import { useEffect, useState } from 'react'
import { isStandalone, platform } from '../../beta/device'
import { disablePush, enablePush, newsWanted, pushEnabled, pushSupported, setNewsPush } from '../../beta/push'
import { Icon } from '../Icon'
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
  if (iosNotInstalled) return <p className="small muted">{t('push.iosHint')}</p>
  if (on === null || (compact && on)) return null

  async function toggle() {
    setBusy(true); setNote('')
    try {
      if (on) { await disablePush(); setOn(false) }
      else if (await enablePush(lang)) setOn(true)
      else setNote(t('push.denied'))
    } catch { setNote(t('fb.error')) } finally { setBusy(false) }
  }
  if (!compact) return (
    <div className="set-row">
      <span className="set-ico"><Icon name="bell" size={18} /></span>
      <div><b>{t('push.title')}</b><span className="small muted">{t('push.desc')}</span>
        {note && <span className="small bad-text">{note}</span>}</div>
      <button type="button" role="switch" aria-checked={!!on} aria-label={t('push.title')} className={`switch${on ? ' on' : ''}`}
              disabled={busy} onClick={toggle}><i /></button>
    </div>
  )
  return (
    <div className="push-toggle">
      {compact && <p className="small">{t('push.offer')}</p>}
      <button className={`btn small-btn${on ? '' : ' primary'}`} disabled={busy} onClick={toggle}>
        <Icon name="bell" size={16} />{on ? t('push.off') : t('push.enable')}</button>
      {note && <p className="small bad-text">{note}</p>}
    </div>
  )
}

/** Notizie principali (solo con le notifiche attive). */
export function NewsPushToggle() {
  const { t } = useI18n()
  const [on, setOn] = useState(newsWanted)
  return (
    <div className="set-row">
      <span className="set-ico"><Icon name="news" size={18} /></span>
      <div><b>{t('push.news')}</b><span className="small muted">{t('push.newsHint')}</span></div>
      <button type="button" role="switch" aria-checked={on} aria-label={t('push.news')} className={`switch${on ? ' on' : ''}`}
              onClick={() => { setOn(!on); void setNewsPush(!on) }}><i /></button>
    </div>
  )
}
