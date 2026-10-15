// La pagina Notizie del sito: intestazione del sito (logo, lingua, Apri l'app) e le Notizie dell'app.
import { LANGS, useI18n, type Lang } from '../i18n/core'
import { NewsScreen } from '../ui/screens/NewsScreen'

const BASE = import.meta.env.BASE_URL

export function NewsPage() {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="app site-news">
      <header className="top">
        <a className="logo" href={BASE}>Quadriamo<span>.</span></a>
        <select className="lang" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('lang.label')}>
          {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <a className="btn primary small-btn" href={`${BASE}app/`}>{t('site.openApp')}</a>
      </header>
      <NewsScreen onAction={() => { location.href = `${BASE}app/` }} />
    </div>
  )
}
