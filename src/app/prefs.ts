// Preferenze di questo dispositivo (non si sincronizzano: il tema o la vibrazione dipendono dal telefono che hai in mano).
import { useSyncExternalStore } from 'react'

export interface Prefs {
  theme: 'auto' | 'light' | 'dark'      // automatico = segue il sistema
  haptics: boolean                       // piccola vibrazione al tocco (Android)
  motion: 'system' | 'reduce'            // "riduci animazioni" anche se il sistema non lo chiede
  text: 'normal' | 'large'               // testo più grande in tutta l'app
}
const KEY = 'q.prefs'
const DEFAULTS: Prefs = { theme: 'auto', haptics: true, motion: 'system', text: 'normal' }
const read = (): Prefs => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS } }

let current = read()
const listeners = new Set<() => void>()

export const getPrefs = () => current
export function setPrefs(p: Partial<Prefs>) {
  current = { ...current, ...p }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* niente: vale fino alla chiusura */ }
  applyPrefs()
  listeners.forEach(f => f())
}
export const usePrefs = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, getPrefs)

/** Le preferenze diventano attributi della pagina: il CSS fa il resto (tema, movimento, dimensione del testo). */
export function applyPrefs() {
  const root = document.documentElement
  if (current.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = current.theme
  if (current.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion
  if (current.text === 'large') root.dataset.text = 'large'; else delete root.dataset.text
  // la barra del browser e quella di stato prendono il colore della pagina
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#F6F4EF')
}

/** Animazioni ridotte: se lo chiede il sistema o se l'utente l'ha scelto qui. */
export const reducedMotion = () => current.motion === 'reduce' ||
  (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// in automatico, se il sistema passa da chiaro a scuro (es. al tramonto) la barra di stato segue
if (typeof window !== 'undefined') window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs)
