import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/core'
import { Icon } from '../Icon'
import { tap } from './motion'

/**
 * Elenchi del Profilo e delle impostazioni: un titolo, righe separate da una linea, niente riquadri.
 * Group raccoglie le righe; Row è una riga (pagina, link, interruttore o semplice valore); Page è una pagina di dettaglio.
 */
export function Group({ title, children, foot }: { title?: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <ul className="group-list">{children}</ul>
      {foot && <p className="group-foot">{foot}</p>}
    </section>
  )
}

type RowProps = {
  label: ReactNode
  value?: ReactNode                 // a destra, in grigio (es. "Automatico", "0.9-beta")
  detail?: ReactNode                // sotto l'etichetta, più piccolo
  danger?: boolean
} & ({ onClick: () => void; href?: never; toggle?: never }
   | { href: string; onClick?: never; toggle?: never }
   | { toggle: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }; onClick?: never; href?: never }
   | { onClick?: never; href?: never; toggle?: never })

export function Row({ label, value, detail, danger, ...kind }: RowProps) {
  const body = <>
    <span className="row-main"><span className={danger ? 'bad-text' : undefined}>{label}</span>{detail && <small>{detail}</small>}</span>
    {value != null && <span className="row-value">{value}</span>}
  </>
  if ('toggle' in kind && kind.toggle) {
    const { on, onChange, disabled } = kind.toggle
    return <li><label className="row">{body}
      <button type="button" role="switch" aria-checked={on} className={`switch${on ? ' on' : ''}`} disabled={disabled}
              onClick={() => { tap(); onChange(!on) }}><i /></button></label></li>
  }
  if ('href' in kind && kind.href) return <li><a className="row" href={kind.href} target="_blank" rel="noopener">{body}<Icon name="external" size={16} className="row-chev" /></a></li>
  if ('onClick' in kind && kind.onClick) {
    const go = kind.onClick
    return <li><button className="row" onClick={() => { tap(); go() }}>{body}{!danger && <Icon name="chevron" size={18} className="row-chev" />}</button></li>
  }
  return <li><div className="row">{body}</div></li>
}

/** Pagina di dettaglio: Indietro, titolo, contenuto. Entra da destra (sei "dentro" una voce). */
export function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="screen sub-in">
      <button className="back-btn" onClick={() => { tap(); onBack() }}><Icon name="back" size={20} />{t('prof.back')}</button>
      <h1 className="screen-title">{title}</h1>
      {children}
    </div>
  )
}
