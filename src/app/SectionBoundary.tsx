// Se una pagina si rompe, si rompe solo lei: messaggio chiaro e un modo per uscirne, il resto dell'app continua.
// Il caso più comune è la connessione: una sezione aperta per la prima volta senza rete non riesce a scaricarsi.
// Allora lo diciamo, e la pagina si ricarica da sola quando la rete torna (una sezione non scaricata si riprova solo ricaricando).
import { Component, useEffect, type ReactNode } from 'react'
import { useI18n } from '../i18n/core'
import { Empty } from '../ui/kit/Empty'

// "Failed to fetch dynamically imported module" (Chrome), "Importing a module script failed" (Safari), "error loading dynamically imported module" (Firefox)
const isOffline = (e: unknown) => !navigator.onLine || /dynamically imported module|module script failed/i.test(String((e as Error)?.message ?? e))
const reload = () => window.location.reload()

class Boundary extends Component<{ children: ReactNode; fallback: (offline: boolean) => ReactNode }, { failed: boolean; offline: boolean }> {
  state = { failed: false, offline: false }
  static getDerivedStateFromError(e: unknown) { return { failed: true, offline: isOffline(e) } }
  componentDidCatch(error: unknown) { console.error('[Quadriamo]', error) }
  render() { return this.state.failed ? this.props.fallback(this.state.offline) : this.props.children }
}

export function SectionBoundary({ children }: { children: ReactNode }) {
  return <Boundary fallback={offline => offline ? <Offline /> : <Broken />}>{children}</Boundary>
}

function Offline() {
  const { t } = useI18n()
  useEffect(() => { window.addEventListener('online', reload); return () => window.removeEventListener('online', reload) }, [])
  return <Empty title={t('err.offlineTitle')} text={t('err.offlineText')} quiet action={{ label: t('err.retry'), onClick: () => { if (navigator.onLine) reload() } }} />
}

function Broken() {
  const { t } = useI18n()
  return <Empty title={t('err.title')} text={t('err.text')} quiet action={{ label: t('err.reload'), onClick: reload }} />
}
