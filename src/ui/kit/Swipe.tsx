import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n/core'
import { tap } from './motion'

const HINT = 'q.swipeHint'
// zone che scorrono già di lato o dove si scrive: lì il gesto non cambia mese
const SKIP = 'input, textarea, select, .filter-row, .goals, .chips, .hc-donut, .hc-bars, dialog, .bs-root'

/**
 * Scorrere col dito a destra/sinistra per andare al periodo prima/dopo (come i calendari e le app delle banche).
 * La pagina segue il dito; al rilascio il contenuto nuovo entra dal lato giusto. Frecce ← → sul computer.
 */
export function Swipe({ id, onPrev, onNext, hint, children }: { id: string; onPrev: () => void; onNext: () => void; hint?: boolean; children: ReactNode }) {
  const { t } = useI18n()
  const start = useRef<{ x: number; y: number; on: boolean | null } | null>(null)
  const [dx, setDx] = useState(0)
  const [dir, setDir] = useState<'left' | 'right' | null>(null)
  const [showHint, setShowHint] = useState(() => { try { return !!hint && !localStorage.getItem(HINT) } catch { return false } })
  const go = (d: 'prev' | 'next') => {
    tap(); setDir(d === 'next' ? 'left' : 'right')
    if (showHint) { setShowHint(false); try { localStorage.setItem(HINT, '1') } catch { /* niente */ } }
    if (d === 'next') onNext(); else onPrev()
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest?.('input, textarea, select, [contenteditable]') || document.body.classList.contains('sheet-open') || document.querySelector('dialog[open]')) return
      if (e.key === 'ArrowLeft') go('prev'); else if (e.key === 'ArrowRight') go('next')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  return (
    <div className="swipe"
      onTouchStart={e => { const tgt = e.target as HTMLElement; start.current = tgt.closest(SKIP) ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY, on: null } }}
      onTouchMove={e => {
        const s = start.current; if (!s) return
        const x = e.touches[0].clientX - s.x, y = e.touches[0].clientY - s.y
        if (s.on == null && (Math.abs(x) > 10 || Math.abs(y) > 10)) s.on = Math.abs(x) > Math.abs(y) * 1.4   // decide una volta: orizzontale o scroll
        if (s.on) setDx(x * 0.6)
      }}
      onTouchEnd={() => {
        const s = start.current; start.current = null
        if (s?.on && Math.abs(dx) > 50) go(dx < 0 ? 'next' : 'prev')
        setDx(0)
      }}>
      {showHint && <p className="swipe-hint"><span>‹</span>{t('swipe.hint')}<span>›</span></p>}
      <div key={id} className={`swipe-page${dir ? ` from-${dir}` : ''}`}
           style={dx ? { transform: `translateX(${dx}px)`, opacity: 1 - Math.min(.35, Math.abs(dx) / 600), transition: 'none' } : undefined}
           onAnimationEnd={() => setDir(null)}>
        {children}
      </div>
    </div>
  )
}
