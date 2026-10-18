// Ingresso: tutto quello che viene prima dell'app (caricamento, email confermata, nuova password, benvenuto e accesso,
// configurazione iniziale, primo budget). Quando l'app è pronta mostra i figli.
import { useEffect, useState, type ReactNode } from 'react'
import { demoAppData } from '../demo'
import { fromSiteAccount, ENTRY } from '../entry'
import { todayIso } from '../engine'
import { LANGS, useI18n, type Lang } from '../i18n/core'
import { useStore } from '../store/context'
import { createInitial } from '../store/state'
import { useSync } from '../sync/context'
import { setupPending } from '../sync/profile'
import { isStandalone } from '../beta/device'
import { LoginScreen } from '../ui/LoginScreen'
import { ConfirmedScreen, Gate, Splash } from '../ui/Gate'
import { guessCurrency } from '../ui/names'
import { Onboarding } from '../ui/Onboarding'
import { SetupWizard } from '../ui/SetupWizard'

import { EntryContext } from './entryContext'
import { ENV } from '../env'

export function Entry({ children }: { children: ReactNode }) {
  const { lang } = useI18n()
  const { state, dispatch } = useStore()
  const sync = useSync()
  const today = todayIso()
  const data = state.data
  // schermata di accesso (dal sito "Accedi o registrati", o dall'app) e configurazione iniziale a passaggi
  const [authOpen, setAuthOpen] = useState(fromSiteAccount)
  const [, setTick] = useState(0)
  const refresh = () => setTick(x => x + 1)
  // aperta dal pulsante dell'email di conferma nel browser: "Email confermata, torna sull'app e accedi"
  const [confirmed, setConfirmed] = useState(() => ENTRY.get('confirmed') === '1' && !isStandalone())
  const inSetup = setupPending.get()
  // nuovo account senza dati su questo dispositivo: si crea il budget e parte la configurazione
  const newAccount = !data && state.loaded && !!sync.user && inSetup
  useEffect(() => { if (newAccount) dispatch({ type: 'replace', data: createInitial(guessCurrency(), todayIso(), 1) }) }, [newAccount, dispatch])

  if (!state.loaded || !sync.ready) return <Splash />
  if (confirmed) return <ConfirmedScreen onContinue={() => setConfirmed(false)} />
  // "password dimenticata": prima la nuova password, poi l'app
  if (sync.recovery) return <div className="gate gate-login"><div className="gate-panel"><LoginScreen /></div></div>

  // senza il server (copia locale di sviluppo): solo su questo dispositivo; se non c'è ancora un budget parte la configurazione
  const startLocal = () => {
    setAuthOpen(false)
    if (!data) { setupPending.set(); dispatch({ type: 'replace', data: createInitial(guessCurrency(), today, 1) }) }
    refresh()
  }
  const demo = () => sync.startDemo(demoAppData(today, lang))
  // serve l'account per usare l'app: senza, solo i dati di esempio (che non vanno mai online).
  // Il vecchio archivio senza proprietario resta nel recupero locale, separato dall'account.
  if (sync.enabled && !sync.user && !sync.isolatedPreview) return <Gate hasData={!!data} onLocal={startLocal} onDemo={demo} />
  if (!sync.enabled && !data) return <Gate hasData={false} onLocal={startLocal} onDemo={demo} />

  if (data && inSetup && !data.demo) return <PreApp><SetupWizard onDone={() => { setupPending.clear(); refresh(); window.scrollTo(0, 0) }} /></PreApp>
  if (data && authOpen && sync.enabled && !sync.user) return <PreApp><LoginScreen footer={<BackLink onClick={() => setAuthOpen(false)} />} /></PreApp>
  if (!data) {
    return <PreApp><Onboarding onStart={(currency, startDay) => dispatch({ type: 'replace', data: createInitial(currency, today, startDay) })} onDemo={demo} /></PreApp>
  }
  return <EntryContext.Provider value={{ openLogin: () => { setAuthOpen(true); window.scrollTo(0, 0) }, inSetup }}>{children}</EntryContext.Provider>
}

function BackLink({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return <button className="link-btn" onClick={onClick}>{t('onb.back')}</button>
}

/** Intestazione delle schermate prima dell'app: logo, stato della sincronizzazione, lingua (finché non ci sono dati). */
function PreApp({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n()
  const { state } = useStore()
  const sync = useSync()
  return (
    <div className="app">
      <header className="top">
        <a className="logo" href={ENV.base}>Quadriamo<span>.</span> <small className="beta">{t('beta.badge')}</small></a>
        {sync.user && (
          <button className="sync-pill" onClick={() => void sync.syncNow()} title={t('sync.now')}>
            <span className={`dot ${sync.status}`} aria-hidden="true" />
            {sync.status === 'syncing' ? t('sync.syncing') : sync.status === 'error' ? '!' : sync.status === 'offline' ? 'offline' : t('sync.ok')}
          </button>
        )}
        {!state.data && (
          <select className="lang" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('lang.label')}>
            {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        )}
      </header>
      {children}
    </div>
  )
}
