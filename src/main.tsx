import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { applyPrefs } from './app/prefs'
import { watchDiagnostics } from './app/diagnostics'
import { watchErrors } from './app/errors'
import { watchSessions } from './beta/sessions'
import { watchUpdates } from './app/updates'
import { watchInputMode } from './app/inputMode'
import { SectionBoundary } from './app/SectionBoundary'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { prepareI18n } from './i18n/core'
import { SessionProvider } from './sync/SessionProvider'
import { AccountBoundary } from './sync/AccountBoundary'

applyPrefs()   // tema, movimento e testo prima del primo disegno: niente lampo di colore
watchDiagnostics()  // diario tecnico in memoria: schermate, azioni, rallentamenti
watchErrors()       // gli errori sui telefoni degli utenti arrivano all'area admin, con il diario
watchSessions()     // come si usa l'app, solo con il consenso alle statistiche anonime
watchUpdates()      // versioni nuove appena l'app torna in primo piano
watchInputMode()    // tastiera o tocco: il contorno del fuoco si vede con la tastiera, anche su iPad
// la lingua prima del primo disegno: solo quella in uso, già in memoria dalla seconda apertura
void prepareI18n().then(start => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider start={start}>
      <SessionProvider>
        <AccountBoundary>
          {/* l'ultima rete: se si rompe qualcosa fuori dalle sezioni, un messaggio invece della pagina bianca */}
          <SectionBoundary><App /></SectionBoundary>
        </AccountBoundary>
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
))

// Interfaccia ferma come un'app: niente zoom con due dita (iOS ignora user-scalable=no); il doppio tocco lo blocca il CSS
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false })
