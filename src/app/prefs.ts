// Preferenze di questo dispositivo (non si sincronizzano: il tema o la vibrazione dipendono dal telefono che hai in mano).
import { useSyncExternalStore } from 'react'
import { local } from '../storage'

export interface Prefs {
  theme: 'auto' | 'light' | 'dark'      // automatico = segue il sistema
  haptics: boolean                       // piccola vibrazione al tocco (Android)
  motion: 'system' | 'reduce'            // "riduci animazioni" anche se il sistema non lo chiede
  text: 'normal' | 'large'               // testo più grande in tutta l'app
}
const KEY = 'q.prefs'
const DEFAULTS: Prefs = { theme: 'auto', haptics: true, motion: 'system', text: 'normal' }
const read = (): Prefs => ({ ...DEFAULTS, ...local.json<Partial<Prefs>>(KEY, {}) })

let current = read()
const listeners = new Set<() => void>()

export const getPrefs = () => current
export function setPrefs(p: Partial<Prefs>) {
  current = { ...current, ...p }
  local.setJson(KEY, current)
  applyPrefs()
  listeners.forEach(f => f())
}
export const usePrefs = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, getPrefs)

/** Le preferenze diventano attributi della pagina: il CSS fa il resto (tema, movimento, dimensione del testo). */
export function applyPrefs() {
  const root = document.documentElement
  if (current.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = current.theme
  // le barre di sistema (stato e navigazione) del colore di fondo della sezione, anche col tema scelto a mano
  setTimeout(() => {
    const c = getComputedStyle(root).getPropertyValue('--bg-t').trim()
    if (c) for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = c
  }, 700)
  if (current.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion
  if (current.text === 'large') root.dataset.text = 'large'; else delete root.dataset.text
}

/** Animazioni ridotte: se lo chiede il sistema o se l'utente l'ha scelto qui. */
export const reducedMotion = () => current.motion === 'reduce' ||
  (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// in automatico, se il sistema passa da chiaro a scuro (es. al tramonto) la barra di stato segue
if (typeof window !== 'undefined') window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs)
