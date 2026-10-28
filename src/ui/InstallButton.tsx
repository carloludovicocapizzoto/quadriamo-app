import { useEffect, useState } from 'react'
import { isStandalone as standalone } from '../beta/device'
import { PAGES } from '../config'
import { useI18n } from '../i18n/core'
import { Group, Row } from './kit/List'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Installa l'app: su Chrome/Android con il pulsante del browser, altrove (iPhone) con la guida. Nascosto se è già installata. */
export function InstallButton({ rows = false }: { rows?: boolean }) {
  const { t, lang } = useI18n()
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(standalone)
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  if (installed) return null
  const how = `${PAGES.install}?lang=${lang}`
  // nella pagina dei dati: due righe, con la spiegazione sotto
  if (rows) return (
    <Group foot={t('settings.install')}>
      {evt && <Row label={t('install.button')} onClick={async () => { await evt.prompt(); setEvt(null) }} />}
      <Row label={t('install.how')} href={how} />
    </Group>
  )
  return (
    <div className="stack-row">
      {evt && <button className="btn primary" onClick={async () => { await evt.prompt(); setEvt(null) }}>⤓ {t('install.button')}</button>}
      <a className="btn" href={how} target="_blank" rel="noopener">{t('install.how')}</a>
    </div>
  )
}
