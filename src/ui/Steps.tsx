import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useI18n } from '../i18n/core'

/** Intestazione di un percorso a passaggi: "Passaggio 2 di 3" e una barra con un segmento per passaggio. */
export function StepHeader({ n, total, title }: { n: number; total: number; title: string }) {
  const { t } = useI18n()
  return (
    <div className="step-head">
      <div className="step-bar" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} className={i < n ? 'on' : ''} />)}</div>
      <p className="step-count">{t('step.of', { n, total })}</p>
      <h4 className="step-title">{title}</h4>
    </div>
  )
}

/** Pulsanti in fondo al passaggio: Indietro (se c'è) e il pulsante principale. */
export function StepNav({ onBack, next, busy, extra }: { onBack?: () => void; next: string; busy?: boolean; extra?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="step-nav">
      {onBack && <button type="button" className="btn" onClick={onBack}><Icon name="back" size={16} />{t('step.back')}</button>}
      <button className="btn primary" disabled={busy}>{next}</button>
      {extra}
    </div>
  )
}
