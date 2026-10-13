// Navigazione dell'app: un solo modo di cambiare pagina, scritto nell'indirizzo (#/analysis/transactions).
// Così il tasto Indietro (Android, browser) torna alla pagina precedente come in un'app nativa.
import { useSyncExternalStore } from 'react'

export type Tab = 'home' | 'news' | 'analysis' | 'profile'
export type AnalysisView = 'transactions' | 'month' | 'year' | 'investments'
export type ProfilePage = 'notifications' | 'plan' | 'account' | 'budget' | 'recurring' | 'rules' | 'data' | 'shared' | 'beta' | 'language'

export type Route =
  | { tab: 'home' }
  | { tab: 'news' }
  | { tab: 'analysis'; view: AnalysisView; month?: string; year?: number }   // month: "YYYY-MM"
  | { tab: 'profile'; page?: ProfilePage }

const VIEWS: AnalysisView[] = ['transactions', 'month', 'year', 'investments']
const PAGES: ProfilePage[] = ['notifications', 'plan', 'account', 'budget', 'recurring', 'rules', 'data', 'shared', 'beta', 'language']

export function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [a, b] = path.split('/')
  const q = new URLSearchParams(query)
  if (a === 'news') return { tab: 'news' }
  if (a === 'analysis') {
    const view = VIEWS.includes(b as AnalysisView) ? b as AnalysisView : 'transactions'
    const month = /^\d{4}-\d{2}$/.test(q.get('m') ?? '') ? q.get('m')! : undefined
    const year = /^\d{4}$/.test(q.get('y') ?? '') ? Number(q.get('y')) : undefined
    return { tab: 'analysis', view, ...(month ? { month } : {}), ...(year ? { year } : {}) }
  }
  if (a === 'profile') return PAGES.includes(b as ProfilePage) ? { tab: 'profile', page: b as ProfilePage } : { tab: 'profile' }
  return { tab: 'home' }
}

export function format(r: Route): string {
  if (r.tab === 'home') return '#/'
  if (r.tab === 'news') return '#/news'
  if (r.tab === 'profile') return r.page ? `#/profile/${r.page}` : '#/profile'
  const q = new URLSearchParams()
  if (r.month) q.set('m', r.month)
  if (r.year) q.set('y', String(r.year))
  const qs = q.toString()
  return `#/analysis/${r.view}${qs ? `?${qs}` : ''}`
}

/** Cambia pagina. `replace`: senza aggiungere un passo alla cronologia (es. cambiare mese). */
export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const hash = format(r)
  if (hash === (location.hash || '#/')) return
  if (opts.replace) history.replaceState(history.state, '', hash)
  else history.pushState(history.state, '', hash)
  emit()
  // nuova pagina: si riparte dall'alto (non per i cambi di mese/anno nella stessa pagina)
  if (!opts.replace) window.scrollTo(0, 0)
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach(f => f())
const subscribe = (f: () => void) => {
  if (!listeners.size) { window.addEventListener('popstate', emit); window.addEventListener('hashchange', emit) }
  listeners.add(f)
  return () => { listeners.delete(f); if (!listeners.size) { window.removeEventListener('popstate', emit); window.removeEventListener('hashchange', emit) } }
}
let cache = { hash: '', route: parse('') }
const snapshot = () => {
  const h = location.hash
  if (h !== cache.hash) cache = { hash: h, route: parse(h) }
  return cache.route
}

export function useRoute(): Route { return useSyncExternalStore(subscribe, snapshot) }
