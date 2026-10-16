// La schermata che spiega le notifiche prima del popup del sistema (linee guida di Android e Apple).
import { useState } from 'react'
import { enablePush } from '../../beta/push'
import { toast } from '../../app/toast'
import { useI18n } from '../../i18n/core'
import { Icon } from '../Icon'
import { Sheet } from '../kit/Sheet'
import { closeAsk, useAskOpen } from './ask'

export function NotifyAsk() {
  const { t, lang } = useI18n()
  const open = useAskOpen()
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  async function yes() {
    setBusy(true)
    const ok = await enablePush(lang).catch(() => false)
    setBusy(false)
    if (ok) { closeAsk(); toast(t('ask.on')) } else setDenied(true)
  }
  return (
    <Sheet open={open} onClose={closeAsk}>
      <div className="notify-ask">
        <span className="na-ico" aria-hidden="true"><Icon name="bell" size={28} /></span>
        <h2>{t('ask.title')}</h2>
        <p className="muted">{t('ask.text')}</p>
        <ul className="na-list">
          {(['ask.b1', 'ask.b2', 'ask.b3'] as const).map(k => <li key={k}><Icon name="check" size={16} />{t(k)}</li>)}
        </ul>
        {denied ? <>
          <p className="small">{t('ask.denied')}</p>
          <button className="btn wide" onClick={closeAsk}>{t('action.close')}</button>
        </> : <>
          <button className="btn primary wide" disabled={busy} onClick={() => void yes()}>{t('ask.yes')}</button>
          <button className="link-btn na-later" onClick={closeAsk}>{t('ask.later')}</button>
        </>}
      </div>
    </Sheet>
  )
}
