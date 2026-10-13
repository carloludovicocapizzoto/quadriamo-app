import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { applyPrefs } from './app/prefs'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { StoreProvider } from './store/StoreProvider'
import { SyncProvider } from './sync/SyncProvider'

applyPrefs()   // tema, movimento e testo prima del primo disegno: niente lampo di colore
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <StoreProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </StoreProvider>
    </I18nProvider>
  </StrictMode>,
)

// Interfaccia ferma come un'app: niente zoom con due dita (iOS ignora user-scalable=no); il doppio tocco lo blocca il CSS
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false })
