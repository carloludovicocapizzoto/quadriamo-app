// Area amministratore di Quadriamo (pagina /admin/): stessa struttura della "Sezione aziendale" di Growmi,
// barra laterale con le sezioni e area di lavoro a destra.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../sync/client'
import { newCode, saveKey, savedKey, sha256Hex, type AdminKey } from './adminKey'
import { checkSetup, loadAccounts, loadDevices, loadFeedback, loadProfileStats, loadPush, loadStats, sendPush,
  type Account, type Device, type Feedback, type ProfileStats, type PushSub, type Setup, type Stats } from './data'
import { sampleAccounts, sampleDevices, sampleFeedback, sampleProfiles, samplePush, sampleSetup, sampleStats } from './sample'
import { AccountsPanel, DashboardPanel, DevicesPanel, FeedbackPanel, ProfilesPanel, PushPanel, SetupPanel } from './panels'

type Panel = 'dashboard' | 'dispositivi' | 'account' | 'profili' | 'feedback' | 'notifiche' | 'configurazione'
const NAV: { group: string; items: [Panel, string][] }[] = [
  { group: 'Panoramica', items: [['dashboard', '📊 Dashboard']] },
  { group: 'Persone', items: [['dispositivi', '📱 Dispositivi'], ['account', '👤 Account'], ['profili', '🧭 Profili']] },
  { group: 'Ascolto', items: [['feedback', '💬 Feedback'], ['notifiche', '🔔 Notifiche']] },
  { group: 'Impostazioni', items: [['configurazione', '⚙️ Configurazione']] },
]
const TITLES: Record<Panel, [string, string]> = {
  dashboard: ['Dashboard', 'Quante persone usano Quadriamo e come.'],
  dispositivi: ['Dispositivi', 'Ogni telefono o computer che usa l’app (solo chi ha accettato le statistiche).'],
  account: ['Account', 'Chi si è registrato.'],
  profili: ['Profili', 'Cosa raccontano di sé gli iscritti (facoltativo), in forma aggregata.'],
  feedback: ['Feedback', 'Voti e commenti arrivati dall’app.'],
  notifiche: ['Notifiche', 'Manda la richiesta di feedback direttamente sui dispositivi.'],
  configurazione: ['Configurazione', 'Cosa è attivo su Supabase e cosa manca.'],
}
const APP_URL = `${import.meta.env.BASE_URL}app/`
const DEMO = new URLSearchParams(window.location.search).get('demo') === '1'

export function AdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [key, setKey] = useState<AdminKey | null>(savedKey)
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (DEMO) return <Shell email="anteprima con dati di esempio" demo />
  if (!ready) return null
  if (!supabase) return <Gate><p className="az-msg error">Questa versione non è collegata a Supabase.</p></Gate>
  // con nome + codice si entra senza account
  if (key) return <Shell email={key.name} adminKey={key} onLogout={() => { saveKey(null); setKey(null) }} />
  if (!session) return <Login onKey={k => { saveKey(k); setKey(k) }} />
  return <Shell email={session.user.email ?? ''} onLogout={() => void supabase!.auth.signOut()} />
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="az-gate">
      <div className="az-gate-card">
        <div className="az-brand big">Quadriamo<span>.</span> <small>Area amministratore</small></div>
        {children}
      </div>
    </div>
  )
}

function Login({ onKey }: { onKey: (k: AdminKey) => void }) {
  const [mode, setMode] = useState<'key' | 'email'>('key')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setMsg({ text: 'Email o password non corretti.', bad: true })
  }
  async function link() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMsg({ text: 'Scrivi prima la tua email.', bad: true }); return }
    setBusy(true); setMsg(null)
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}admin/` } })
    setBusy(false)
    setMsg(error ? { text: 'Invio non riuscito: riprova tra qualche minuto.', bad: true } : { text: 'Ti abbiamo mandato un link: aprilo da questo dispositivo.' })
  }
  function enter(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setMsg({ text: 'Scrivi il tuo nome.', bad: true }); return }
    if (code.trim().length < 20) { setMsg({ text: 'Il codice deve avere almeno 20 caratteri: generane uno con il pulsante qui sotto.', bad: true }); return }
    onKey({ name: name.trim(), code: code.trim() })
  }
  if (mode === 'key') {
    return (
      <Gate>
        <h1>Accedi</h1>
        <p className="az-hint">Con il tuo nome e il codice amministratore. Questo dispositivo li ricorda.</p>
        <form className="az-form" onSubmit={enter}>
          <label className="az-field"><span>Nome</span><input autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="az-field"><span>Codice amministratore</span><input type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} /></label>
          <button className="az-btn primary big">Entra</button>
          <button type="button" className="az-link" onClick={() => { const c = newCode(); setCode(c); void navigator.clipboard?.writeText(c).catch(() => {})
            setMsg({ text: `Nuovo codice: ${c} — è già copiato. Salvalo (per esempio nelle Note o nel portachiavi delle password): ti servirà su altri dispositivi.` }) }}>
            Primo accesso? Genera un codice sicuro</button>
          {msg && <p className={`az-msg ${msg.bad ? 'error' : 'ok'}`} role="status">{msg.text}</p>}
        </form>
        <p className="az-hint">Il primo accesso con un codice nuovo apre la Configurazione: lì copi lo script che lo attiva su Supabase.</p>
        <p className="az-hint"><button className="az-link" onClick={() => { setMode('email'); setMsg(null) }}>Entra con email e password</button> · <a href={APP_URL}>← Torna all'app</a></p>
      </Gate>
    )
  }
  return (
    <Gate>
      <h1>Accedi</h1>
      <p className="az-hint">Con lo stesso account che usi nell'app. <button className="az-link" onClick={() => { setMode('key'); setMsg(null) }}>Usa nome e codice</button></p>
      <form className="az-form" onSubmit={submit}>
        <label className="az-field"><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="az-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="az-btn primary big" disabled={busy}>Accedi</button>
        <button type="button" className="az-link" disabled={busy} onClick={() => void link()}>Non hai la password? Ricevi un link di accesso via email</button>
        {msg && <p className={`az-msg ${msg.bad ? 'error' : 'ok'}`} role="status">{msg.text}</p>}
      </form>
      <p className="az-hint"><a href={APP_URL}>← Torna all'app</a></p>
    </Gate>
  )
}

function Shell({ email, demo = false, adminKey, onLogout }: { email: string; demo?: boolean; adminKey?: AdminKey; onLogout?: () => void }) {
  const [keyHash, setKeyHash] = useState('')
  useEffect(() => { if (adminKey) void sha256Hex(adminKey.code).then(setKeyHash) }, [adminKey])
  const [panel, setPanelState] = useState<Panel>(() => (new URLSearchParams(window.location.search).get('panel') as Panel) || 'dashboard')
  const [menu, setMenu] = useState(false)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [push, setPush] = useState<PushSub[]>([])
  const [profiles, setProfiles] = useState<ProfileStats | null>(null)
  const [error, setError] = useState('')

  const setPanel = (p: Panel) => {
    setPanelState(p); setMenu(false)
    const q = new URLSearchParams(demo ? 'demo=1' : '')
    if (p !== 'dashboard') q.set('panel', p)
    history.pushState({ panel: p }, '', q.size ? `?${q}` : window.location.pathname)
  }
  useEffect(() => {
    const onPop = () => setPanelState((new URLSearchParams(window.location.search).get('panel') as Panel) || 'dashboard')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const recheck = useCallback(async () => {
    const s = demo ? sampleSetup : await checkSetup(true)
    setSetup(s)
    if (!s.admin) setPanelState('configurazione')
    return s
  }, [demo])
  const load = useCallback(async () => {
    setError('')
    if (demo) {
      setStats(sampleStats(days)); setDevices(sampleDevices); setAccounts(sampleAccounts); setFeedback(sampleFeedback); setPush(samplePush); setProfiles(sampleProfiles); return
    }
    try {
      const [st, dv, ac, fb, pu, pr] = await Promise.all([loadStats(days), loadDevices(), loadAccounts(), loadFeedback(), loadPush(),
        loadProfileStats().catch(() => null)])   // null se lo script dei profili non è ancora stato eseguito
      setStats(st); setDevices(dv); setAccounts(ac); setFeedback(fb); setPush(pu); setProfiles(pr)
    } catch (e) { setError((e as Error).message) }
  }, [days, demo])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dati dal server
    void recheck().then(s => { if (s.admin) void load() })
  }, [recheck, load])

  const [title, lead] = TITLES[panel]
  const locked = setup && !setup.admin && panel !== 'configurazione'
  return (
    <div className="az-shell">
      <button className="az-sidebar-toggle" aria-label="Apri menu" onClick={() => setMenu(true)}>☰</button>
      <div className={`az-sidebar-backdrop${menu ? ' open' : ''}`} onClick={() => setMenu(false)} />
      <aside className={`az-sidebar${menu ? ' open' : ''}`}>
        <div className="az-brand">Quadriamo<span>.</span> <small>Area amministratore</small></div>
        <nav className="az-sidebar-nav">
          {NAV.map(g => (
            <div key={g.group} className="az-nav-group">
              <p className="az-nav-group-label">{g.group}</p>
              {g.items.map(([id, text]) => (
                <button key={id} className={`az-nav-item${panel === id ? ' is-active' : ''}`} onClick={() => setPanel(id)}>
                  {text}{id === 'configurazione' && setup && (!setup.admin || !setup.profiles || setup.fn !== 'ok') && <span className="az-dot" aria-label="da completare" />}
                </button>
              ))}
            </div>
          ))}
          <a className="az-nav-item" href={APP_URL}>↗ Apri l'app</a>
        </nav>
        <div className="az-sidebar-footer">
          <span className="az-sidebar-user" title={email}>{email}</span>
          {demo ? <a className="az-logout" href={window.location.pathname}>Esci</a>
            : <button className="az-logout" onClick={onLogout}>Esci</button>}
        </div>
      </aside>
      <main className="az-main">
        <div className="az-main-header">
          <div><h1>{title}</h1><p>{lead}</p></div>
          {setup?.admin && panel !== 'configurazione' && <button className="az-btn" onClick={() => void load()}>↻ Aggiorna</button>}
        </div>
        {demo && <p className="az-msg ok">Anteprima con dati inventati: i numeri veri compaiono qui dopo la configurazione.</p>}
        {!setup && <p className="az-empty">Caricamento…</p>}
        {locked && <p className="az-msg error">Completa prima la configurazione.</p>}
        {error && setup?.admin && <p className="az-msg error">Errore nel caricare i dati: {error}</p>}
        {setup && panel === 'configurazione' && <SetupPanel setup={setup} email={email} adminKey={adminKey && keyHash ? { name: adminKey.name, hash: keyHash } : undefined} onRecheck={() => void recheck().then(s => { if (s.admin) void load() })} />}
        {setup?.admin && panel === 'dashboard' && stats && <DashboardPanel stats={stats} days={days} setDays={setDays} />}
        {setup?.admin && panel === 'dispositivi' && <DevicesPanel rows={devices} />}
        {setup?.admin && panel === 'account' && <AccountsPanel rows={accounts} />}
        {setup?.admin && panel === 'profili' && (profiles ? <ProfilesPanel p={profiles} />
          : <p className="az-msg error">Esegui lo script dei profili (sezione Configurazione, passo 1).</p>)}
        {setup?.admin && panel === 'feedback' && <FeedbackPanel rows={feedback} />}
        {setup?.admin && panel === 'notifiche' && <PushPanel rows={push} setup={setup} onSend={async (t, b) => {
          if (demo) return 'Anteprima: nessuna notifica inviata.'
          const r = await sendPush(t, b); void load()
          return `Inviate ${r.sent} su ${r.total}${r.removed ? ` · ${r.removed} iscrizioni scadute rimosse` : ''}${r.failed ? ` · ${r.failed} non riuscite` : ''}`
        }} />}
      </main>
    </div>
  )
}
