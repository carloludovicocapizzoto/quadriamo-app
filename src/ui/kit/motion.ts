import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { getPrefs, reducedMotion as reduced } from '../../app/prefs'

/**
 * Numero che passa dal valore di prima a quello nuovo quando cambia: si vede dove va a finire la spesa.
 * All'apertura è già al suo posto (contare da zero decorerebbe, non spiegherebbe niente).
 */
export function useCountUp(value: number, ms = 500): number {
  const still = reduced()
  const [shown, setShown] = useState(value)
  const from = useRef(shown)
  useEffect(() => {
    if (still) { from.current = value; return }
    const a = from.current, t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3)
      setShown(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, still])
  return still ? value : shown
}

/** Piccola vibrazione al tocco dove il telefono la supporta (Android). */
export const tap = () => { if (!getPrefs().haptics) return; try { navigator.vibrate?.(8) } catch { /* niente */ } }

type WithTransitions = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
/**
 * Una voce che diventa la pagina: l'elemento con data-morph="key" (la voce toccata) si sposta e cresce fino a
 * diventare l'elemento con la stessa chiave nella pagina nuova (il titolo), e al ritorno fa la strada inversa.
 * Spiega dove sei entrato. Senza View Transitions o con "Riduci movimento": cambio immediato, come prima.
 */
export function morph(key: string, update: () => void) {
  const d = document as WithTransitions
  if (reduced() || !d.startViewTransition) { update(); return }
  const el = () => document.querySelector<HTMLElement>(`[data-morph="${CSS.escape(key)}"]`)
  const name = (x: HTMLElement | null, v: string) => { if (x) x.style.viewTransitionName = v }
  name(el(), 'morph')
  document.documentElement.classList.add('morphing')
  const tr = d.startViewTransition(() => {
    name(el(), '')
    flushSync(update)
    name(el(), 'morph')
  })
  void tr.finished.finally(() => { name(el(), ''); document.documentElement.classList.remove('morphing') })
}
