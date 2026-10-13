import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
export const tap = () => { try { navigator.vibrate?.(8) } catch { /* niente */ } }
