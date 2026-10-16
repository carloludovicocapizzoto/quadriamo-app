// Pagina Notizie del sito (/notizie/): lo stesso componente delle Notizie dell'app (sezioni, filtri, ricerca, podcast, consigli),
// dentro l'intestazione del sito. Le azioni dei consigli portano all'app. Stesso design system, stesso sfondo della sezione.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import { applyPrefs } from '../app/prefs'
import { I18nProvider } from '../i18n'
import { prepareI18n } from '../i18n/core'
import { NewsPage } from './NewsPage'

applyPrefs()
document.documentElement.dataset.section = 'news'

void prepareI18n().then(start => createRoot(document.getElementById('root')!).render(<StrictMode><I18nProvider start={start}><NewsPage /></I18nProvider></StrictMode>))
