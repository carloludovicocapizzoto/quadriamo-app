import { FEEDBACK_EMAIL, PAGES } from '../config'
import { useI18n } from '../i18n/core'

export function LegalLinks({ notice = false }: { notice?: boolean }) {
  const { t, lang } = useI18n()
  return (
    <p className="muted small legal">
      {notice && <>{t('legal.notice')} </>}
      <a href={`${PAGES.terms}?lang=${lang}`} target="_blank" rel="noopener">{t('legal.terms')}</a>
      {' · '}
      <a href={`${PAGES.privacy}?lang=${lang}`} target="_blank" rel="noopener">{t('legal.privacy')}</a>
      {FEEDBACK_EMAIL && <>{' · '}<a href={`mailto:${FEEDBACK_EMAIL}?subject=Quadriamo%20beta`}>{t('beta.feedback')}</a></>}
    </p>
  )
}
