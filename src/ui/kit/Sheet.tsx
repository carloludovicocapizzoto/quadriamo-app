import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Il pannello che sale dal basso: l'unico modo dell'app per mostrare qualcosa sopra la pagina.
 * - fisico: si apre e si chiude con una molla, segue il dito, si chiude se lo lanci verso il basso (velocità) o lo trascini oltre un terzo;
 * - interrompibile e reversibile: se si riapre mentre si chiude (o viceversa) riparte dal punto in cui è, senza salti;
 * - accessibile: Esc chiude, il fuoco entra nel pannello e torna dove era alla chiusura.
 */
export function Sheet({ open, onClose, title, children, label }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; label?: string }) {
  const [mounted, setMounted] = useState(open)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLElement | null>(null)
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null)
  if (open && !mounted) setMounted(true)

  // la posizione la decide la classe "open" (CSS), il movimento è una transizione: per questo si interrompe e si inverte da sola
  useLayoutEffect(() => {
    const r = root.current
    if (!r) return
    if (open) {
      back.current = document.activeElement as HTMLElement | null
      void panel.current?.getBoundingClientRect()   // prima la posizione chiusa, poi quella aperta: la transizione parte sempre
      r.classList.add('open')
      const first = panel.current?.querySelector<HTMLElement>('[autofocus]')
      ;(first ?? panel.current)?.focus({ preventScroll: true })
      return
    }
    r.classList.remove('open')
    // rete di sicurezza: se la transizione non parte (es. chiuso prima di aprirsi) si smonta comunque
    const id = setTimeout(() => setMounted(false), 700)
    return () => clearTimeout(id)
  }, [open, mounted])

  useEffect(() => {
    if (!mounted) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    document.body.classList.add('sheet-open')
    return () => { document.removeEventListener('keydown', key); document.body.classList.remove('sheet-open') }
  }, [mounted, onClose])

  if (!mounted) return null
  // chiusura finita: si smonta solo quando il pannello ha davvero finito di scendere
  const onEnd = (e: React.TransitionEvent) => {
    if (e.target === panel.current && e.propertyName === 'transform' && !open) { setMounted(false); back.current?.focus?.() }
  }
  const setY = (y: number | null) => { if (panel.current) panel.current.style.transform = y == null ? '' : `translateY(${y}px)` }
  return createPortal(
    <div ref={root} className="bs-root" role="presentation" onClick={onClose}>
      <div ref={panel} className="bs" role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)} tabIndex={-1}
           onClick={e => e.stopPropagation()} onTransitionEnd={onEnd}>
        <div className="bs-grab" aria-hidden="true"
             onPointerDown={e => { drag.current = { y: e.clientY, t: performance.now(), dy: 0, v: 0 }; e.currentTarget.setPointerCapture(e.pointerId); panel.current?.classList.add('dragging') }}
             onPointerMove={e => {
               const d = drag.current; if (!d) return
               const now = performance.now(), dy = Math.max(0, e.clientY - d.y)
               d.v = (dy - d.dy) / Math.max(1, now - d.t); d.dy = dy; d.t = now
               setY(dy)
             }}
             onPointerUp={() => {
               const d = drag.current; drag.current = null; panel.current?.classList.remove('dragging')
               if (!d) return
               setY(null)   // dalla posizione del dito: torna su con la molla, oppure scende se chiuso
               // chiude se lanciato verso il basso o trascinato oltre un terzo
               if (d.v > 0.6 || d.dy > (panel.current?.offsetHeight ?? 600) / 3) onClose()
             }}><i /></div>
        {title && <h2 className="bs-title">{title}</h2>}
        <div className="bs-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
