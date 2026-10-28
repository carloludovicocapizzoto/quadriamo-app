import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { tap } from './motion'

/**
 * Controllo a schede: un'opzione sola tra poche (Mese/Anno/…, Spese/Entrate, Chiaro/Scuro, Accedi/Crea account).
 * La pillola scivola sotto l'opzione scelta con la molla. Uno solo per tutta l'app.
 * Una scritta lunga (es. «Transactions») allarga la sua colonna: la pillola prende posizione e larghezza vere della voce scelta.
 */
export function Segmented<T extends string>({ options, value, onChange, label, role = 'tablist', className = '' }: {
  options: { id: T; label: ReactNode; badge?: number }[]; value: T; onChange: (v: T) => void
  label?: string; role?: 'tablist' | 'radiogroup'; className?: string
}) {
  const at = Math.max(0, options.findIndex(o => o.id === value))
  const item = role === 'tablist' ? 'tab' : 'radio'
  const box = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const place = () => {
      const b = el.querySelectorAll<HTMLButtonElement>(':scope > button')[at]
      if (b) setPill(p => p?.x === b.offsetLeft && p.w === b.offsetWidth ? p : { x: b.offsetLeft, w: b.offsetWidth })
    }
    place()
    // la lingua, il carattere o lo schermo cambiano le larghezze: la pillola segue
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(place)
    ro.observe(el); el.querySelectorAll(':scope > button').forEach(b => ro.observe(b))
    return () => ro.disconnect()
  }, [at, options.length])
  return (
    <div ref={box} className={`segmented ${className}`} role={role} aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(o => (
        <button type="button" key={o.id} role={item} aria-selected={item === 'tab' ? o.id === value : undefined} aria-checked={item === 'radio' ? o.id === value : undefined}
          className={o.id === value ? 'on' : ''} onClick={() => { if (o.id !== value) { tap(); onChange(o.id) } }}>
          {o.label}{!!o.badge && <em className="seg-badge">{o.badge}</em>}
        </button>
      ))}
      <span className="seg-pill" style={pill ? { left: 0, width: pill.w, transform: `translateX(${pill.x}px)` }
        : { width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${at * 100}%)` }} />
    </div>
  )
}
