// Area amministratore di Quadriamo (pagina /admin/): parte dello stesso prodotto (design system unico, src/design),
// barra laterale, area di lavoro, ricerca globale ⌘K e scorciatoie G + lettera.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../sync/client'
import { newCode, saveKey, savedKey, sha256Hex, type AdminKey } from './adminKey'
import { checkSetup, loadAccounts, loadAlternatives, loadCohorts, loadDevices, loadFeedback, loadPush, loadResearch, loadStats, sendPush,
  type Account, type Cohort, type Device, type Feedback, type PushSub, type ResearchStats, type Setup, type Stats } from './data'
import { sampleAccounts, sampleAlternatives, sampleCohorts, sampleDevices, sampleFeedback, samplePush, sampleResearch, sampleSetup, sampleStats } from './sample'
import { ErrorsPanel } from './ErrorsPanel'
import { Icon, type IconName } from '../ui/Icon'
import { CommandPalette, type Command } from './CommandPalette'
import { AccountsPanel, DashboardPanel, DevicesPanel, FeedbackPanel, PushPanel, ResearchPanel, SetupPanel } from './panels'

type Panel = 'dashboard' | 'dispositivi' | 'account' | 'ricerca' | 'feedback' | 'notifiche' | 'errori' | 'configurazione'
const NAV: { group: string; items: [Panel, string, IconName][] }[] = [
  { group: 'Panoramica', items: [['dashboard', 'Dashboard', 'chart']] },
  { group: 'Persone', items: [['dispositivi', 'Dispositivi', 'list'], ['account', 'Account', 'user'], ['ricerca', 'Ricerca anonima', 'lock']] },
  { group: 'Ascolto', items: [['feedback', 'Feedback', 'message'], ['notifiche', 'Notifiche', 'bell'], ['errori', 'Errori', 'alert']] },
  { group: 'Impostazioni', items: [['configurazione', 'Configurazione', 'settings']] },
]
const TITLES: Record<Panel, [string, string]> = {
  dashboard: ['Dashboard', 'Quante persone usano Quadriamo e come.'],
  dispositivi: ['Dispositivi', 'Ogni telefono o computer che usa l’app (solo chi ha accettato le statistiche).'],
  account: ['Account', 'Chi si è registrato.'],
  ricerca: ['Ricerca anonima', 'Totali delle schede che gli utenti scelgono di inviare in forma anonima. Dati riservati.'],
  feedback: ['Feedback', 'Voti e commenti arrivati dall’app.'],
  notifiche: ['Notifiche', 'Manda la richiesta di feedback direttamente sui dispositivi.'],
  errori: ['Errori', 'Cosa si è rotto sui dispositivi degli utenti, raggruppato per messaggio.'],
  configurazione: ['Configurazione', 'Cosa è attivo su Supabase e cosa manca.'],
}
const APP_URL = `${import.meta.env.BASE_URL}app/`
// scorciatoie: G poi la lettera del pannello (come Linear)
const KEYS: Record<string, Panel> = { d: 'dashboard', v: 'dispositivi', a: 'account', r: 'ricerca', f: 'feedback', n: 'notifiche', e: 'errori', c: 'configurazione' }
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
  const [research, setResearch] = useState<ResearchStats | null>(null)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [alternatives, setAlternatives] = useState<Record<string, number>>({})
  // la ricerca anonima si vede solo dopo aver reinserito il codice (o la password); si richiude lasciando la sezione
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState('')

  const [cmd, setCmd] = useState(false)
  const setPanel = (p: Panel) => {
    setPanelState(p); setMenu(false); setUnlocked(false)
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
  const goRef = useRef<(p: Panel) => void>(() => {})
  useEffect(() => { goRef.current = setPanel })
  useEffect(() => {
    let g = 0
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(x => !x); return }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'g') { g = Date.now(); return }
      const p = KEYS[e.key.toLowerCase()]
      if (p && Date.now() - g < 1200) { e.preventDefault(); g = 0; goRef.current(p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const load = useCallback(async () => {
    setError('')
    if (demo) {
      setStats(sampleStats(days)); setDevices(sampleDevices); setAccounts(sampleAccounts); setFeedback(sampleFeedback); setPush(samplePush); setResearch(sampleResearch); setCohorts(sampleCohorts); setAlternatives(sampleAlternatives); return
    }
    try {
      const [st, dv, ac, fb, pu, pr] = await Promise.all([loadStats(days), loadDevices(), loadAccounts(), loadFeedback(), loadPush(),
        loadResearch().catch(() => null)])   // null se lo script 0007 non è ancora stato eseguito
      setStats(st); setDevices(dv); setAccounts(ac); setFeedback(fb); setPush(pu); setResearch(pr)
      // script 0008: se manca, le due sezioni restano vuote
      setCohorts(await loadCohorts().catch(() => [])); setAlternatives(await loadAlternatives().catch(() => ({})))
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
              {g.items.map(([id, text, icon]) => (
                <button key={id} className={`az-nav-item${panel === id ? ' is-active' : ''}`} onClick={() => setPanel(id)}>
                  <Icon name={icon} size={18} />{text}{id === 'configurazione' && setup && (!setup.admin || !setup.profiles || setup.fn !== 'ok') && <span className="az-dot" aria-label="da completare" />}
                </button>
              ))}
            </div>
          ))}
          <a className="az-nav-item" href={APP_URL}><Icon name="external" size={18} />Apri l'app</a>
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
          {cmd && <CommandPalette onClose={() => setCmd(false)} accounts={accounts} feedback={feedback} devices={devices} onPanel={p => setPanel(p)}
            commands={[
              ...NAV.flatMap(g => g.items.map(([id, text, icon]): Command => ({ id: `p-${id}`, group: 'Pannelli', icon, label: text,
                hint: `G ${Object.entries(KEYS).find(([, v]) => v === id)?.[0].toUpperCase() ?? ''}`, run: () => setPanel(id) }))),
              { id: 'x-reload', group: 'Azioni', icon: 'refresh', label: 'Aggiorna i dati', run: () => void load() },
              { id: 'x-app', group: 'Azioni', icon: 'external', label: "Apri l'app", run: () => { window.open(APP_URL, '_blank') } },
              { id: 'x-push', group: 'Azioni', icon: 'bell', label: 'Manda una notifica di feedback', run: () => setPanel('notifiche') },
              { id: 'x-errors', group: 'Azioni', icon: 'alert', label: 'Controlla gli errori dell\'app', run: () => setPanel('errori') },
            ]} />}
          <div className="az-head-actions">
            <button className="az-btn az-cmd-btn" onClick={() => setCmd(true)} aria-label="Cerca e azioni"><Icon name="search" size={16} />Cerca<kbd>⌘K</kbd></button>
            {setup?.admin && panel !== 'configurazione' && <button className="az-btn" onClick={() => void load()}><Icon name="refresh" size={16} />Aggiorna</button>}
          </div>
        </div>
        {demo && <p className="az-msg ok">Anteprima con dati inventati: i numeri veri compaiono qui dopo la configurazione.</p>}
        {!setup && <p className="az-empty">Caricamento…</p>}
        {locked && <p className="az-msg error">Completa prima la configurazione.</p>}
        {error && setup?.admin && <p className="az-msg error">Errore nel caricare i dati: {error}</p>}
        {setup && panel === 'configurazione' && <SetupPanel setup={setup} email={email} adminKey={adminKey && keyHash ? { name: adminKey.name, hash: keyHash } : undefined} onRecheck={() => void recheck().then(s => { if (s.admin) void load() })} />}
        {setup?.admin && panel === 'dashboard' && stats && <DashboardPanel stats={stats} days={days} setDays={setDays} cohorts={cohorts} />}
        {setup?.admin && panel === 'dispositivi' && <DevicesPanel rows={devices} />}
        {setup?.admin && panel === 'account' && <AccountsPanel rows={accounts} />}
        {setup?.admin && panel === 'ricerca' && (!research
          ? <p className="az-msg error">Esegui lo script aggiornato (sezione Configurazione, passo 1).</p>
          : unlocked || demo ? <ResearchPanel r={research} />
          : <Unlock adminKey={adminKey} email={email} onOk={() => setUnlocked(true)} />)}
        {setup?.admin && panel === 'errori' && !DEMO && <ErrorsPanel />}
        {setup?.admin && panel === 'feedback' && <FeedbackPanel rows={feedback} alternatives={alternatives} />}
        {setup?.admin && panel === 'notifiche' && <PushPanel rows={push} setup={setup} onSend={async (t, b) => {
          if (demo) return 'Anteprima: nessuna notifica inviata.'
          const r = await sendPush(t, b); void load()
          return `Inviate ${r.sent} su ${r.total}${r.removed ? ` · ${r.removed} iscrizioni scadute rimosse` : ''}${r.failed ? ` · ${r.failed} non riuscite` : ''}`
        }} />}
      </main>
    </div>
  )
}

/** Secondo controllo prima dei dati della ricerca: il codice amministratore (o la password, per chi entra con l'email). */
function Unlock({ adminKey, email, onOk }: { adminKey?: AdminKey; email: string; onOk: () => void }) {
  const [value, setValue] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBad(false)
    if (adminKey) { if (value.trim() === adminKey.code) onOk(); else setBad(true); return }
    setBusy(true)
    const { error } = await supabase!.auth.signInWithPassword({ email, password: value })
    setBusy(false)
    if (error) setBad(true); else onOk()
  }
  return (
    <div className="az-card az-lock">
      <h3>Dati riservati</h3>
      <p className="az-hint">Per vedere i totali della ricerca anonima inserisci di nuovo {adminKey ? 'il tuo codice amministratore' : 'la tua password'}.
        La sezione si richiude quando la lasci.</p>
      <form className="az-form" onSubmit={submit}>
        <label className="az-field"><span>{adminKey ? 'Codice amministratore' : 'Password'}</span>
          <input type="password" autoComplete="current-password" value={value} onChange={e => setValue(e.target.value)} autoFocus /></label>
        <div><button className="az-btn primary" disabled={busy}>Mostra i dati</button></div>
        {bad && <p className="az-msg error">{adminKey ? 'Codice non corretto.' : 'Password non corretta.'}</p>}
      </form>
    </div>
  )
}
