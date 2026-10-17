// Monogramma di un servizio: la sigla nel colore del marchio, in un quadrato dagli angoli morbidi (come l'icona di un'app).
// Niente loghi veri (marchi registrati). Il testo è chiaro o scuro secondo il colore di fondo, per restare leggibile.
// Senza servizio: le iniziali del nome su un fondo neutro.
import type { CSSProperties } from 'react'
import { serviceById } from '../../content/services'

/** Luminanza relativa (WCAG) di un colore #RRGGBB. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '·'

export function Monogram({ service, name, size = 40 }: { service?: string | null; name: string; size?: number }) {
  const s = serviceById(service)
  const text = s ? s.mono ?? s.name[0] : initials(name)
  const style = {
    '--mono-size': `${size}px`,
    ...(s ? { '--mono-bg': s.color, '--mono-fg': luminance(s.color) > 0.45 ? '#111' : '#fff' } : {}),
  } as CSSProperties
  return <span className={`mono${s ? '' : ' plain'}${text.length > 2 ? ' long' : ''}`} style={style} aria-hidden="true">{text}</span>
}
