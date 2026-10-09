import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { StoreProvider } from './store/StoreProvider'
import { SyncProvider } from './sync/SyncProvider'

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
