import { useSyncExternalStore } from 'react'

/** Vero quando la media query è soddisfatta; si aggiorna se cambia (es. si gira il tablet o si allarga la finestra). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    f => { const m = matchMedia(query); m.addEventListener('change', f); return () => m.removeEventListener('change', f) },
    () => matchMedia(query).matches,
    () => false,
  )
}
