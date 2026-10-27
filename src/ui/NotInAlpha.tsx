import { useI18n } from '../i18n/core'

/** Una funzione che usa servizi del server non ancora attivi in questa Alpha (src/features.ts): lo si dice, senza pulsanti che falliscono. */
export function NotInAlpha() {
  const { t } = useI18n()
  return <section className="empty" role="status"><p><b>{t('alpha.notYetTitle')}</b></p><p className="muted small">{t('alpha.notYetText')}</p></section>
}
