import { useEffect, useMemo, useState } from 'react'
import { demoAppData } from './demo'
import { ENTRY, fromSiteAccount } from './entry'
import { computeMonth, monthOf, safeToSpend, streakOf, todayIso, undated, type ClassifiedTx, type Transaction, type YearMonth } from './engine'
import { LANGS, useI18n, type Lang } from './i18n/core'
import { useStore } from './store/context'
import { createInitial } from './store/state'
import { useSync } from './sync/context'
import { MonthNav } from './ui/MonthNav'
import { MonthView } from './ui/MonthView'
import { Onboarding } from './ui/Onboarding'
import { SettingsView } from './ui/SettingsView'
import { TransactionsView } from './ui/TransactionsView'
import { TxForm } from './ui/TxForm'
import { YearNav, YearView } from './ui/YearView'
import { InvestmentsView } from './ui/InvestmentsView'
import { FxAutoUpdate } from './ui/FxAutoUpdate'
import { feedbackDue, firstOpenToday, statsConsent } from './beta/device'
import { track } from './beta/telemetry'
import { BetaSection } from './ui/beta/BetaSection'
import { ConsentCard } from './ui/beta/ConsentCard'
import { FeedbackCard } from './ui/beta/FeedbackCard'
import { ProfileForm } from './ui/ProfileForm'
import { HomeView } from './ui/HomeView'
import { SharedView } from './ui/shared/SharedView'
import { saveMorningSnapshot } from './beta/morning'
import { syncPush, touchPush } from './beta/push'
import { StreakCelebration } from './ui/Streak'
import { bucketName } from './ui/names'
import { noAccount, profilePrompt, setupPending } from './sync/profile'
import { ConfirmedScreen, Gate, Splash } from './ui/Gate'
import { isStandalone } from './beta/device'
import { LoginScreen } from './ui/AccountSection'
import { SetupWizard } from './ui/SetupWizard'
import { guessCurrency } from './ui/names'

type Tab = 'home' | 'month' | 'transactions' | 'year' | 'investments' | 'settings' | 'shared'

export default function App() {
  const { t, lang, setLang } = useI18n()
  const { state, dispatch } = useStore()
  const sync = useSync()
  const today = todayIso()
  // ?login=1 / ?signup=1 (pulsanti del sito): si apre direttamente l'area account
  // ?join=CODICE (invito a un budget comune): si apre direttamente il budget comune
  const [tab, setTab] = useState<Tab>(() => ENTRY.get('join') ? 'shared' : 'home')
  const [ym, setYm] = useState<YearMonth | null>(null)
  const [year, setYear] = useState(() => Number(todayIso().slice(0, 4)))
  // link di inserimento rapido: ?add=1&amount=12,50&desc=Pizza&cat=eatingOut (scorciatoia sull'icona, Comandi Rapidi)
  const [form, setForm] = useState<{ tx?: Transaction; prefill?: { amount?: string; description?: string; category?: string } } | null>(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('add') !== '1') return null
    return { prefill: { amount: q.get('amount') ?? undefined, description: q.get('desc') ?? undefined, category: q.get('cat') ?? undefined } }
  })
  // beta: richiesta di feedback (dal link della notifica, o ogni 10 giorni) e dashboard (?admin=1)
  const [showFeedback, setShowFeedback] = useState(() =>
    new URLSearchParams(window.location.search).get('feedback') === '1' || feedbackDue())
  useEffect(() => {
    // vecchio indirizzo della dashboard: ora è una pagina a sé
    if (new URLSearchParams(window.location.search).get('admin') === '1') { window.location.replace(`${import.meta.env.BASE_URL}admin/`); return }
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
    const onInstalled = () => { void track('install') }
    window.addEventListener('appinstalled', onInstalled)
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])
  const [askProfile, setAskProfile] = useState(() => profilePrompt.get())
  // schermata di accesso (dal sito "Accedi o registrati", o da Impostazioni) e configurazione iniziale a passaggi
  const [authOpen, setAuthOpen] = useState(fromSiteAccount)
  const [setupTick, setSetupTick] = useState(0)
  // aperta dal pulsante dell'email di conferma nel browser: "Email confermata, torna sull'app e accedi"
  const [confirmed, setConfirmed] = useState(() => ENTRY.get('confirmed') === '1' && !isStandalone())
  const inSetup = setupPending.get() && setupTick >= 0
  const [note, setNote] = useState('')
  const data = state.data

  const current = ym ?? (data ? monthOf(today, data.settings.monthStartDay) : null)
  const result = useMemo(
    () => data && current ? computeMonth(current, data.transactions, data.settings, today) : null,
    [data, current, today])
  const homeResult = useMemo(
    () => data ? computeMonth(monthOf(today, data.settings.monthStartDay), data.transactions, data.settings, today) : null,
    [data, today])

  const streak = useMemo(() => data && !data.demo ? streakOf(data.activity ?? [], today) : null, [data, today])
  // aggiornato oggi: il server non manda il promemoria "a sorpresa" (riceve solo la data)
  useEffect(() => { if (streak?.doneToday) void touchPush(today) }, [streak?.doneToday, today])

  // riepilogo per la notifica del mattino (resta sul dispositivo)
  useEffect(() => {
    if (!data || !homeResult || data.demo) { void saveMorningSnapshot(null); return }
    const items = safeToSpend(homeResult, data.settings, today).map(x => ({
      name: bucketName(data.settings.buckets.find(b => b.id === x.bucketId)!, t), free: Math.max(0, x.free) }))
    void saveMorningSnapshot({ lang, currency: data.settings.currency, end: homeResult.period.end, items, updatedAt: new Date().toISOString(),
      streak: streak?.count ?? 0, lastActive: data.activity?.at(-1) })
  }, [data, homeResult, today, lang, t, streak])

  // statistiche anonime (solo con consenso): una "fotografia" al giorno con soli conteggi
  const ping = (yes = statsConsent() === 'yes') => {
    if (!yes || !data || data.demo || !firstOpenToday(today)) return
    const months = new Set(data.transactions.map(t => t.date?.slice(0, 7)).filter(Boolean))
    void track('open', { txCount: data.transactions.length, monthsUsed: months.size, signedIn: !!sync.user, lang })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta per caricamento dei dati
  useEffect(() => { if (state.loaded) ping() }, [state.loaded, !!data])
  useEffect(() => { void syncPush(lang) }, [lang])

  // nuovo account senza dati su questo dispositivo: si crea il budget e parte la configurazione
  const newAccount = !data && state.loaded && !!sync.user && inSetup
  useEffect(() => {
    if (newAccount) dispatch({ type: 'replace', data: createInitial(guessCurrency(), todayIso(), 1) })
  }, [newAccount, dispatch])

  if (!state.loaded || !sync.ready) return <Splash />

  // senza account: si usa solo su questo dispositivo; se non c'è ancora un budget parte la configurazione
  const startLocal = () => {
    noAccount.set(); setAuthOpen(false)
    if (!data) { setupPending.set(); dispatch({ type: 'replace', data: createInitial(guessCurrency(), today, 1) }) }
    setSetupTick(x => x + 1)
  }
  if (confirmed) return <ConfirmedScreen onContinue={() => setConfirmed(false)} />
  // "password dimenticata": prima la nuova password, poi l'app
  if (sync.recovery) return <div className="gate gate-login"><div className="gate-glow" aria-hidden="true" /><div className="gate-panel"><LoginScreen /></div></div>
  // ingresso: chi non ha fatto l'accesso (e non ha scelto di usarla senza account) vede benvenuto e accesso
  if (sync.enabled && !sync.user && !sync.recovery && (!noAccount.get() || (authOpen && !data))) {
    return <Gate hasData={!!data} onLocal={startLocal}
      onDemo={() => { noAccount.set(); setSetupTick(x => x + 1); dispatch({ type: 'replace', data: demoAppData(today) }) }} />
  }
  if (!sync.enabled && !data) return <Gate hasData={false} onLocal={startLocal} onDemo={() => dispatch({ type: 'replace', data: demoAppData(today) })} />

  const header = (
    <header className="top">
      <a className="logo" href={import.meta.env.BASE_URL}>Quadriamo<span>.</span> <small className="beta">{t('beta.badge')}</small></a>
      {sync.user && (
        <button className="sync-pill" onClick={() => void sync.syncNow()} title={t('sync.now')}>
          <span className={`dot ${sync.status}`} aria-hidden="true" />
          {sync.status === 'syncing' ? t('sync.syncing') : sync.status === 'error' ? '!' : sync.status === 'offline' ? 'offline' : t('sync.ok')}
        </button>
      )}
      {!data && (
        <select className="lang" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('lang.label')}>
          {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      )}
    </header>
  )

  if (data && inSetup && !data.demo) {
    return (
      <div className="app">
        {header}
        <SetupWizard onDone={() => { setupPending.clear(); setSetupTick(x => x + 1); window.scrollTo(0, 0) }} />
      </div>
    )
  }
  if (data && authOpen && sync.enabled && !sync.user) {
    return (
      <div className="app">
        {header}
        <LoginScreen footer={<button className="link-btn" onClick={() => setAuthOpen(false)}>{t('onb.back')}</button>} />
      </div>
    )
  }

  if (!data || !result || !current) {
    return (
      <div className="app">
        {header}
        <Onboarding
          onStart={(currency, startDay) => dispatch({ type: 'replace', data: createInitial(currency, today, startDay) })}
          onDemo={() => dispatch({ type: 'replace', data: demoAppData(today) })} />
      </div>
    )
  }

  const openTx = (tx: ClassifiedTx | Transaction) => {
    if ('recurring' in tx && tx.recurring) { setNote(t('tx.recurringHint')); setTimeout(() => setNote(''), 3000); return }
    const orig = data.transactions.find(x => x.id === tx.id)
    if (orig) setForm({ tx: orig })
  }
  // la data proposta è oggi se si guarda il mese corrente, altrimenti l'inizio del mese guardato
  const isCurrent = result.period.start <= today && today <= result.period.end
  const defaultDate = isCurrent || tab === 'home' ? today : result.period.start

  return (
    <div className="app has-nav">
      {header}
      {data.demo && (
        <div className="demo-banner">
          <span>{t('demo.banner')}</span>
          <button className="btn small-btn" onClick={() => {
            const fresh = createInitial(data.settings.currency, today, data.settings.monthStartDay)
            dispatch({ type: 'replace', data: fresh }); setYm(null)
          }}>{t('demo.clear')}</button>
        </div>
      )}

      <main className="app-enter">
        {tab === 'home' && <ConsentCard onAnswer={yes => ping(yes)} />}
        {tab === 'home' && sync.user && askProfile && !data.demo && !inSetup && (
          <section className="card"><h3 className="h-plain">{t('prof.promptTitle')}</h3><ProfileForm onDone={() => setAskProfile(false)} /></section>)}
        {tab === 'home' && showFeedback && <FeedbackCard onClose={() => setShowFeedback(false)} />}
        {tab === 'home' && homeResult && <HomeView data={data} r={homeResult} today={today} streak={streak} onOpen={openTx}
          onAll={() => { setYm(null); setTab('transactions'); window.scrollTo(0, 0) }}
          onShared={() => { setTab('shared'); window.scrollTo(0, 0) }} />}
        {tab === 'shared' && <SharedView onBack={() => { setTab('home'); window.scrollTo(0, 0) }} onLogin={() => { setAuthOpen(true); window.scrollTo(0, 0) }} />}
        {(tab === 'month' || tab === 'transactions') && <MonthNav ym={current} onChange={setYm} />}
        {tab === 'year' && <YearNav year={year} onChange={setYear} />}
        {tab === 'year' && <YearView year={year} transactions={data.transactions} settings={data.settings} today={today}
                                     onYear={setYear} onOpenMonth={m => { setYm(m); setTab('month'); window.scrollTo(0, 0) }} />}
        {tab === 'month' && <MonthView r={result} settings={data.settings} onOpen={openTx} today={today} />}
        {tab === 'transactions' &&
          <TransactionsView r={result} settings={data.settings} undated={undated(data.transactions)} onOpen={openTx} />}
        {tab === 'investments' && <InvestmentsView settings={data.settings} transactions={data.transactions} today={today}
                                                   year={year} onYear={setYear} />}
        {tab === 'settings' && <BetaSection onFeedback={() => { setShowFeedback(true); setTab('home'); window.scrollTo(0, 0) }}
                                            onAdmin={() => window.location.assign(`${import.meta.env.BASE_URL}admin/`)} />}
        {tab === 'settings' && (
          <section className="card"><h3 className="h-plain">👥 {t('sh.title')}</h3><p className="muted small">{t('w.sharedNone')}</p>
            <button className="btn" onClick={() => { setTab('shared'); window.scrollTo(0, 0) }}>{t('w.sharedOpen')} →</button></section>)}
        {tab === 'settings' && <SettingsView onLogin={() => { setAuthOpen(true); window.scrollTo(0, 0) }} />}
        <FxAutoUpdate today={today} />
      </main>

      {note && <div className="toast" role="status">{note}</div>}
      <StreakCelebration s={streak} />

      {(tab === 'home' || tab === 'month' || tab === 'transactions') && (
        <button className="fab" onClick={() => setForm({})} aria-label={t('action.add')}>+</button>
      )}

      <nav className="bottom-nav" aria-label="Quadriamo">
        {(['home', 'month', 'transactions', 'year', 'investments', 'settings'] as const).map(k => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}
                  onClick={() => { setTab(k); if ((k === 'year' || k === 'investments') && current) setYear(current.year); window.scrollTo(0, 0) }}>
            <span aria-hidden="true">{{ home: '⌂', month: '◧', transactions: '☰', year: '▥', investments: '↗', settings: '⚙' }[k]}</span>
            {t(`nav.${k}`)}
          </button>
        ))}
      </nav>

      {form && (
        <TxForm
          settings={data.settings}
          initial={form.tx}
          prefill={form.prefill}
          defaultDate={defaultDate}
          onClose={() => setForm(null)}
          onSave={tx => { dispatch({ type: form.tx ? 'updateTx' : 'addTx', tx }); setForm(null) }}
          onDelete={id => { dispatch({ type: 'deleteTx', id }); setForm(null) }} />
      )}
    </div>
  )
}
