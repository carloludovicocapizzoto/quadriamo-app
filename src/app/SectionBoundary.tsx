// Se una pagina si rompe, si rompe solo lei: messaggio chiaro e un modo per uscirne, il resto dell'app continua.
import { Component, type ReactNode } from 'react'
import { useI18n } from '../i18n/core'

class Boundary extends Component<{ children: ReactNode; fallback: (reset: () => void) => ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error('[Quadriamo]', error) }
  render() { return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children }
}

export function SectionBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <Boundary fallback={reset => (
      <section className="card empty-state" role="alert">
        <b>{t('err.title')}</b><p className="muted small">{t('err.text')}</p>
        <button className="btn" onClick={() => { reset(); window.location.reload() }}>{t('err.reload')}</button>
      </section>
    )}>{children}</Boundary>
  )
}
