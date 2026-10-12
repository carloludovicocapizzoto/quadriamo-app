import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Pannello che sale dal basso (come nelle app native): si chiude toccando fuori, con Esc
 * o trascinandolo verso il basso dalla maniglia.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  const [shown, setShown] = useState(open)
  const [closing, setClosing] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  if (open && !shown) { setShown(true); setClosing(false) }
  if (!open && shown && !closing) setClosing(true)
  useEffect(() => {
    if (!closing) return
    const id = setTimeout(() => { setShown(false); setClosing(false); setDrag(0) }, 220)
    return () => clearTimeout(id)
  }, [closing])
  useEffect(() => {
    if (!shown) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    document.body.classList.add('sheet-open')
    return () => { document.removeEventListener('keydown', key); document.body.classList.remove('sheet-open') }
  }, [shown, onClose])
  if (!shown) return null
  return (
    <div className={`bs-root${closing ? ' closing' : ''}`} role="presentation" onClick={onClose}>
      <div className="bs" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
           style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}>
        <div className="bs-grab"
             onTouchStart={e => { start.current = e.touches[0].clientY }}
             onTouchMove={e => { if (start.current != null) setDrag(Math.max(0, e.touches[0].clientY - start.current)) }}
             onTouchEnd={() => { if (drag > 90) onClose(); else setDrag(0); start.current = null }}><i /></div>
        {title && <h2 className="bs-title">{title}</h2>}
        <div className="bs-body">{children}</div>
      </div>
    </div>
  )
}
