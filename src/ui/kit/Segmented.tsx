import type { ReactNode } from 'react'
import { tap } from './motion'

/**
 * Controllo a schede: un'opzione sola tra poche (Mese/Anno/…, Spese/Entrate, Chiaro/Scuro, Accedi/Crea account).
 * La pillola scivola sotto l'opzione scelta con la molla. Uno solo per tutta l'app.
 */
export function Segmented<T extends string>({ options, value, onChange, label, role = 'tablist', className = '' }: {
  options: { id: T; label: ReactNode; badge?: number }[]; value: T; onChange: (v: T) => void
  label?: string; role?: 'tablist' | 'radiogroup'; className?: string
}) {
  const at = Math.max(0, options.findIndex(o => o.id === value))
  const item = role === 'tablist' ? 'tab' : 'radio'
  return (
    <div className={`segmented ${className}`} role={role} aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(o => (
        <button type="button" key={o.id} role={item} aria-selected={item === 'tab' ? o.id === value : undefined} aria-checked={item === 'radio' ? o.id === value : undefined}
          className={o.id === value ? 'on' : ''} onClick={() => { if (o.id !== value) { tap(); onChange(o.id) } }}>
          {o.label}{!!o.badge && <em className="seg-badge">{o.badge}</em>}
        </button>
      ))}
      <span className="seg-pill" style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${at * 100}%)` }} />
    </div>
  )
}
