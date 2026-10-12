import type { CheckKind } from '../engine'
import { Icon } from './Icon'
import { useI18n } from '../i18n/core'

/** Riquadro dei controlli: "Tutto a posto" oppure l'elenco di cosa sistemare. */
export function Checks({ checks }: { checks: Record<CheckKind, number> }) {
  const { t } = useI18n()
  const issues = (Object.entries(checks) as [CheckKind, number][]).filter(([, n]) => n > 0)
  if (!issues.length) return <span className="pill good"><Icon name="check" size={16} />{t('checks.allGood')}</span>
  return (
    <div className="checks" role="status">
      <strong><Icon name="alert" size={15} />{t('checks.fix')}</strong>
      <ul>{issues.map(([k, n]) => <li key={k}>{t(`check.${k}`)}: {n}</li>)}</ul>
    </div>
  )
}
