// Scorciatoie da tastiera dell'app (computer e iPad con tastiera), le stesse logiche dell'area admin:
// G poi la lettera della sezione, N nuovo movimento, / cerca, ? l'elenco. Mai mentre si scrive in un campo.
import { useEffect } from 'react'
import { openComposer } from './composer'
import { navigate, type Route } from './router'

export const SHORTCUTS: [string, string][] = [
  ['N', 'kb.new'], ['/', 'kb.search'], ['G H', 'kb.home'], ['G N', 'kb.news'], ['G A', 'kb.analysis'],
  ['G M', 'kb.movements'], ['G I', 'kb.invest'], ['G P', 'kb.profile'], ['?', 'kb.help'], ['Esc', 'kb.close'],
]
const GO: Record<string, Route> = {
  h: { tab: 'home' }, n: { tab: 'news' }, a: { tab: 'analysis', view: 'month' }, m: { tab: 'analysis', view: 'transactions' },
  i: { tab: 'analysis', view: 'investments' }, p: { tab: 'profile' },
}
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    let g = 0
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains('sheet-open')) return
      const k = e.key.toLowerCase()
      if (Date.now() - g < 1200 && GO[k]) { e.preventDefault(); g = 0; navigate(GO[k]); return }
      if (k === 'g') { g = Date.now(); return }
      if (k === 'n') { e.preventDefault(); openComposer(); return }
      if (e.key === '?') { e.preventDefault(); onHelp(); return }
      if (e.key === '/') {
        const box = document.querySelector<HTMLInputElement>('input[type=search]')
        if (box) { e.preventDefault(); box.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHelp])
}
