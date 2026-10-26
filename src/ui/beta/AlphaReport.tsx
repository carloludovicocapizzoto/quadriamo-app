// «Segnala un problema» nell'Alpha: le segnalazioni non passano dall'app (il gateway non le accetta) ma vanno a chi
// ha invitato il tester. Qui: cosa scrivere, cosa non mandare mai, e i dettagli tecnici da copiare. Nessun dato finanziario.
import { useState } from 'react'
import { deviceInfo } from '../../app/diagnostics'
import { technicalDetails } from '../../beta/details'
import { useI18n } from '../../i18n/core'
import { useStore } from '../../store/context'
import { useSync } from '../../sync/context'

export function AlphaReport() {
  const { t } = useI18n()
  const sync = useSync()
  const { storage } = useStore()
  const snapshot = storage?.getSnapshot()
  const details = technicalDetails(deviceInfo(), sync, snapshot?.cloud, snapshot?.error, !!navigator.serviceWorker?.controller)
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)
  const copy = async () => { try { await navigator.clipboard.writeText(details); setCopied('yes') } catch { setCopied('no') } }
  return (
    <section className="card alpha-report">
      <p>{t('alpha.reportHow')}</p>
      <ul className="small">
        <li>{t('alpha.reportWhat')}</li>
        <li><b>{t('alpha.reportNever')}</b></li>
        <li>{t('alpha.reportSync')}</li>
      </ul>
      <p className="small muted">{t('alpha.reportDetails')}</p>
      <pre className="alpha-details" tabIndex={0}>{details}</pre>
      <button className="btn" onClick={() => void copy()}>{t('alpha.reportCopy')}</button>
      {copied && <p className="small" role="status">{t(copied === 'yes' ? 'beta.copied' : 'alpha.reportCopyFailed')}</p>}
    </section>
  )
}
