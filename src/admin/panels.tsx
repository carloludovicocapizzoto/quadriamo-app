// Le sezioni dell'area amministratore: componenti "puri" (ricevono i dati), così si provano senza database.
import { useState } from 'react'
import { downloadCsv, label, projectRef, type Account, type Device, type Feedback, type ProfileStats, type PushSub, type Setup, type Stats } from './data'
import sql0002 from '../../supabase/migrations/0002_beta_feedback_stats_push.sql?raw'
import sql0004 from '../../supabase/migrations/0004_profiles.sql?raw'
import sql0005 from '../../supabase/migrations/0005_site_feedback.sql?raw'
import tplConfirm from '../../supabase/templates/confirmation.html?raw'
import tplMagic from '../../supabase/templates/magic_link.html?raw'
import tplRecovery from '../../supabase/templates/recovery.html?raw'
import sql0006 from '../../supabase/migrations/0006_admin_key.sql?raw'
import sql0003 from '../../supabase/migrations/0003_feedback_push_every_10_days.sql?raw'
import fnCode from '../../supabase/functions/send-push/index.ts?raw'

const SITE = 'https://carloludovicocapizzoto.github.io/quadriamo-app/'
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT') : '—')
const yn = (b: boolean | null | undefined) => (b == null ? '—' : b ? 'Sì' : 'No')
const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])

function Stat({ n, l, sub, wide }: { n: string | number; l: string; sub?: string; wide?: boolean }) {
  return <div className={`az-stat${wide ? ' wide' : ''}`}><span className="n">{n}</span><span className="l">{l}</span>{sub && <span className="sub">{sub}</span>}</div>
}
function Bars({ items, total }: { items: [string, number][]; total?: number }) {
  const max = total ?? Math.max(1, ...items.map(i => i[1]))
  if (!items.length) return <p className="az-empty">Ancora nessun dato.</p>
  return (
    <ul className="az-bars">
      {items.map(([k, n]) => (
        <li key={k}><span className="k">{k}</span><span className="track"><span style={{ width: `${max ? (n / max) * 100 : 0}%` }} /></span><b>{n}</b></li>
      ))}
    </ul>
  )
}
function Toolbar({ count, onExport, children }: { count: string; onExport?: () => void; children?: React.ReactNode }) {
  return (
    <div className="az-toolbar">
      <div className="az-toolbar-left">{children}</div>
      <div className="actions"><span className="az-count">{count}</span>{onExport && <button className="az-btn primary" onClick={onExport}>💾 Esporta CSV</button>}</div>
    </div>
  )
}

// ---------- Dashboard ----------
export function DashboardPanel({ stats, days, setDays }: { stats: Stats; days: number; setDays: (n: number) => void }) {
  const daily = stats.daily ?? []
  const max = Math.max(1, ...daily.map(x => x.active))
  const funnel: [string, number][] = [['Hanno aperto l’app', stats.devices], ['Hanno registrato almeno un movimento', stats.with_tx],
    ['Attivati (6+ movimenti: stipendio e 5 spese)', stats.activated], ['Con account', stats.signed_in], ['Con notifiche attive', stats.push]]
  return (
    <>
      <div className="az-stat-grid">
        <Stat wide n={stats.active_7} l="Persone attive negli ultimi 7 giorni" sub={`${stats.active_1} oggi · ${stats.active_30} negli ultimi 30 giorni`} />
        <Stat n={stats.devices} l="Dispositivi totali" />
        <Stat n={stats.accounts} l="Account registrati" />
        <Stat n={stats.installed} l="App installate" sub={pct(stats.installed, stats.devices) + ' dei dispositivi'} />
        <Stat n={stats.avg_tx} l="Movimenti medi per dispositivo" />
        <Stat n={stats.retention_7 == null ? '—' : `${stats.retention_7}%`} l="Tornano dopo 7 giorni" />
        <Stat n={stats.retention_30 == null ? '—' : `${stats.retention_30}%`} l="Tornano dopo 30 giorni" />
        <Stat n={stats.feedback_count} l="Feedback ricevuti" sub={stats.feedback_avg != null ? `voto medio ${stats.feedback_avg}/5` : undefined} />
        <Stat n={stats.push} l="Iscritti alle notifiche" />
      </div>

      <div className="az-card">
        <div className="az-card-head">
          <h3>Accessi giornalieri</h3>
          <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Periodo">
            <option value={7}>Ultimi 7 giorni</option><option value={30}>Ultimi 30 giorni</option><option value={90}>Ultimi 90 giorni</option>
          </select>
        </div>
        <div className="az-chart" role="img" aria-label="Dispositivi attivi per giorno">
          {daily.map(x => (
            <div key={x.day} className="col" title={`${d(x.day)}: ${x.active} attivi, di cui ${x.new} nuovi`}>
              <span className="bar" style={{ height: `${(x.active / max) * 100}%` }}>
                <span className="new" style={{ height: x.active ? `${(x.new / x.active) * 100}%` : 0 }} />
              </span>
            </div>
          ))}
        </div>
        <p className="az-hint"><i className="lg a" /> attivi · <i className="lg n" /> di cui nuovi · {d(daily[0]?.day ?? null)} → {d(daily.at(-1)?.day ?? null)}</p>
      </div>

      <div className="az-cols">
        <div className="az-card">
          <h3>Imbuto della beta</h3>
          <p className="az-hint">Su {stats.devices} dispositivi che hanno aperto l'app.</p>
          <ul className="az-bars">
            {funnel.map(([l, n]) => (
              <li key={l}><span className="k">{l}</span><span className="track"><span style={{ width: `${stats.devices ? (n / stats.devices) * 100 : 0}%` }} /></span>
                <b>{n}</b><span className="pct">{pct(n, stats.devices)}</span></li>
            ))}
          </ul>
        </div>
        <div className="az-card">
          <h3>Azioni nel periodo</h3>
          <Bars items={sorted(stats.events).map(([k, n]) => [label(k), n])} />
        </div>
        <div className="az-card">
          <h3>Lingue</h3>
          <Bars items={sorted(stats.langs).map(([k, n]) => [label(k), n])} />
        </div>
        <div className="az-card">
          <h3>Dispositivi</h3>
          <Bars items={sorted(stats.platforms).map(([k, n]) => [label(k), n])} />
        </div>
      </div>
      <p className="az-hint">I numeri sui dispositivi contano solo chi ha acconsentito alle statistiche anonime; gli account sono il totale degli iscritti.</p>
    </>
  )
}

// ---------- Dispositivi ----------
export function DevicesPanel({ rows }: { rows: Device[] }) {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState('')
  const list = rows.filter(r => (!only || r.platform === only) && (!q || `${r.device_id} ${label(r.lang)} ${label(r.platform)}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <>
      <Toolbar count={`${list.length} dispositivi`} onExport={() => downloadCsv('quadriamo-dispositivi', [
        ['Dispositivo', 'Primo giorno', 'Ultimo giorno', 'Giorni di uso', 'Tipo', 'Lingua', 'Installata', 'Con account', 'Movimenti', 'Mesi', 'Versione'],
        ...list.map(r => [r.device_id, r.first_day, r.last_day, r.active_days, label(r.platform), label(r.lang), yn(r.standalone), yn(r.signed_in), r.tx_count, r.months_used, r.app_version])])}>
        <input className="az-search" placeholder="Cerca…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={only} onChange={e => setOnly(e.target.value)} aria-label="Tipo di dispositivo">
          <option value="">Tutti i tipi</option><option value="ios">iPhone / iPad</option><option value="android">Android</option><option value="desktop">Computer</option>
        </select>
      </Toolbar>
      <div className="az-table-wrap">
        <table className="az-table">
          <thead><tr><th>Dispositivo</th><th>Primo uso</th><th>Ultimo uso</th><th>Giorni</th><th>Tipo</th><th>Lingua</th><th>Installata</th><th>Account</th><th>Movimenti</th><th>Versione</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.device_id}>
                <td className="mono" title={r.device_id}>{r.device_id.slice(0, 8)}</td><td>{d(r.first_day)}</td><td>{d(r.last_day)}</td><td>{r.active_days}</td>
                <td>{label(r.platform)}</td><td>{label(r.lang)}</td><td>{r.standalone ? <span className="az-pill ok">Sì</span> : 'No'}</td>
                <td>{yn(r.signed_in)}</td><td>{r.tx_count ?? '—'}</td><td>{r.app_version ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="az-empty">Nessun dispositivo{rows.length ? ' con questi filtri' : ' finora: arriveranno quando i primi amici aprono l’app e accettano le statistiche'}.</p>}
      <p className="az-hint">Ogni dispositivo è un codice casuale creato sul telefono: non identifica la persona. Nessun importo né descrizione dei movimenti arriva mai qui.</p>
    </>
  )
}

// ---------- Account ----------
export function AccountsPanel({ rows }: { rows: Account[] }) {
  const [q, setQ] = useState('')
  const list = rows.filter(r => !q || `${r.email} ${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Toolbar count={`${list.length} account`} onExport={() => downloadCsv('quadriamo-account', [
        ['Nome', 'Cognome', 'Email', 'Iscritto il', 'Ultimo accesso', 'Profilo compilato', 'Notifiche', 'Feedback'],
        ...list.map(r => [r.first_name, r.last_name, r.email, r.created_at, r.last_sign_in_at, yn(r.profile_done), yn(r.has_push), r.feedback_count])])}>
        <input className="az-search" placeholder="Cerca per nome o email…" value={q} onChange={e => setQ(e.target.value)} />
      </Toolbar>
      <div className="az-table-wrap">
        <table className="az-table">
          <thead><tr><th>Nome</th><th>Email</th><th>Iscritto il</th><th>Ultimo accesso</th><th>Profilo</th><th>Notifiche</th><th>Feedback</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.email}><td>{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td><td>{r.email}</td><td>{d(r.created_at)}</td><td>{dt(r.last_sign_in_at)}</td>
                <td>{r.profile_done ? <span className="az-pill ok">Compilato</span> : '—'}</td>
                <td>{r.has_push ? <span className="az-pill ok">Attive</span> : '—'}</td><td>{r.feedback_count || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="az-empty">Nessun account{rows.length ? ' con questa ricerca' : ' registrato finora'}.</p>}
    </>
  )
}

// ---------- Profili (solo numeri aggregati) ----------
const money = (n: number | null) => (n == null ? '—' : `${Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' })} €`)
export function ProfilesPanel({ p, buckets = ['Essenziali', 'Qualità della vita', 'Fondo di sicurezza', 'Investimenti'] }: { p: ProfileStats; buckets?: string[] }) {
  const items = (o: Record<string, number>) => sorted(o).map(([k, n]) => [label(k), n] as [string, number])
  const bands = Object.entries(p.income_bands).sort().map(([k, n]) => [k.replace(/^\d · /, '') + ' €', n] as [string, number])
  const invested = (p.invested.yes ?? 0) + (p.invested.want ?? 0) + (p.invested.no ?? 0)
  return (
    <>
      <div className="az-stat-grid">
        <Stat n={p.completed} l="Profili compilati" sub={`su ${p.profiles} account`} />
        <Stat n={money(p.income_median)} l="Entrate mensili nette (mediana)" sub={p.with_income ? `media ${money(p.income_avg)} · ${p.with_income} risposte` : undefined} />
        <Stat n={pct(p.invested.yes ?? 0, invested)} l="Ha già investito" sub={invested ? `${pct(p.invested.want ?? 0, invested)} vorrebbe iniziare` : undefined} />
        <Stat n={p.shares_custom} l="Hanno cambiato la regola 55-20-15-10" sub={`${p.shares_default} la tengono`} />
      </div>
      <div className="az-cols">
        <div className="az-card"><h3>Entrate mensili nette</h3><Bars items={bands} /></div>
        <div className="az-card"><h3>Per cosa usano Quadriamo</h3><Bars items={items(p.goals)} total={Math.max(1, p.completed)} /></div>
        <div className="az-card"><h3>Carte e conti</h3><Bars items={items(p.cards)} total={Math.max(1, p.completed)} /></div>
        <div className="az-card"><h3>Investimenti</h3><Bars items={items(p.invested)} />
          {Object.keys(p.invest_where).length > 0 && <><h3 className="az-h3">Dove investono</h3><Bars items={items(p.invest_where)} /></>}</div>
        <div className="az-card"><h3>Divisione media scelta</h3>
          {p.shares_avg?.length === 4
            ? <Bars items={p.shares_avg.map((v, i) => [`${buckets[i]} (${String(v).replace('.', ',')}%)`, v] as [string, number])} total={100} />
            : <p className="az-empty">Ancora nessun dato.</p>}</div>
      </div>
      <p className="az-hint">Solo numeri aggregati: le risposte del singolo non si vedono qui. Le percentuali di obiettivi e carte sono sul numero di profili compilati (si possono scegliere più risposte).</p>
    </>
  )
}

// ---------- Feedback ----------
export function FeedbackPanel({ rows }: { rows: Feedback[] }) {
  const [stars, setStars] = useState(0)
  const rated = rows.filter(r => r.rating != null)
  const avg = rated.length ? (rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length).toFixed(1) : '—'
  const withText = rows.filter(r => r.message).length
  const list = rows.filter(r => !stars || r.rating === stars)
  return (
    <>
      <div className="az-cols">
        <div className="az-card">
          <h3>Voto medio</h3>
          <div className="az-big">{avg}<span className="sub">su 5 · {rated.length} voti · {withText} commenti</span></div>
        </div>
        <div className="az-card">
          <h3>Distribuzione dei voti</h3>
          <Bars items={[5, 4, 3, 2, 1].map(s => [`${'★'.repeat(s)}`, rated.filter(r => r.rating === s).length])} total={Math.max(1, rated.length)} />
        </div>
      </div>
      <Toolbar count={`${list.length} risposte`} onExport={() => downloadCsv('quadriamo-feedback', [
        ['Data', 'Da', 'Voto', 'Commento', 'Email', 'Lingua', 'Versione', 'Con account'],
        ...list.map(r => [r.created_at, r.source === 'site' ? 'Sito' : 'App', r.rating, r.message, r.email, label(r.lang), r.app_version, yn(!!r.user_id)])])}>
        <select value={stars} onChange={e => setStars(Number(e.target.value))} aria-label="Filtra per voto">
          <option value={0}>Tutti i voti</option>{[5, 4, 3, 2, 1].map(s => <option key={s} value={s}>{s} stelle</option>)}
        </select>
      </Toolbar>
      <div className="az-table-wrap">
        <table className="az-table">
          <thead><tr><th>Data</th><th>Da</th><th>Voto</th><th>Commento</th><th>Email</th><th>Lingua</th><th>Versione</th><th>Account</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}><td>{dt(r.created_at)}</td><td>{r.source === 'site' ? <span className="az-pill warn">Sito</span> : 'App'}</td>
                <td className="stars">{r.rating ? <>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></> : '—'}</td>
                <td className="wrap">{r.message ?? '—'}</td><td>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : '—'}</td><td>{label(r.lang)}</td><td>{r.app_version ?? '—'}</td><td>{r.user_id ? 'Sì' : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="az-empty">Nessuna risposta{rows.length ? ' con questo voto' : ' ricevuta finora'}.</p>}
    </>
  )
}

// ---------- Notifiche ----------
export function PushPanel({ rows, setup, onSend }: { rows: PushSub[]; setup: Setup; onSend: (title: string, body: string) => Promise<string> }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const last = rows.map(r => r.last_prompt_at).filter(Boolean).sort().at(-1) ?? null
  const ready = setup.fn === 'ok'
  async function send() {
    if (!confirm(`Inviare la notifica di feedback a ${rows.length} dispositivi?`)) return
    setBusy(true); setMsg(null)
    try { setMsg({ text: await onSend(title, body) }) } catch (e) { setMsg({ text: `Errore: ${(e as Error).message}`, bad: true }) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="az-stat-grid">
        <Stat n={rows.length} l="Dispositivi iscritti" />
        <Stat n={rows.filter(r => r.email).length} l="Di cui con account" />
        <Stat n={last ? d(last) : '—'} l="Ultima notifica inviata" />
        <Stat n={setup.reminder ? 'Attivo' : 'Spento'} l="Promemoria automatico ogni 10 giorni" />
      </div>
      <div className="az-card">
        <h3>Invia una notifica di feedback</h3>
        <p className="az-hint">Arriva sul telefono o sul computer di chi ha attivato le notifiche. Toccandola si apre l'app sul riquadro "Come ti trovi?".
          Lascia vuoto per il testo standard, che ognuno riceve nella sua lingua.</p>
        {!ready && <p className="az-msg error">Prima pubblica la funzione send-push con le chiavi (sezione Configurazione).</p>}
        <div className="az-form">
          <label className="az-field"><span>Titolo</span><input placeholder="Come ti trovi con Quadriamo?" value={title} maxLength={60} onChange={e => setTitle(e.target.value)} /></label>
          <label className="az-field"><span>Testo</span><textarea placeholder="Dacci un parere in 30 secondi: ci aiuta a migliorare la beta." value={body} maxLength={140} onChange={e => setBody(e.target.value)} /></label>
          <div className="az-preview" aria-label="Anteprima">
            <b>🔔 {title || 'Come ti trovi con Quadriamo?'}</b><span>{body || 'Dacci un parere in 30 secondi: ci aiuta a migliorare la beta.'}</span>
          </div>
          <div><button className="az-btn primary big" disabled={busy || !rows.length || !ready} onClick={() => void send()}>{busy ? 'Invio…' : `🔔 Invia a ${rows.length} dispositivi`}</button></div>
          {msg && <p className={`az-msg ${msg.bad ? 'error' : 'ok'}`} role="status">{msg.text}</p>}
        </div>
      </div>
      <h3 className="az-h3">Iscritti</h3>
      <div className="az-table-wrap">
        <table className="az-table">
          <thead><tr><th>Iscritto il</th><th>Lingua</th><th>Account</th><th>Ultima notifica</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{dt(r.created_at)}</td><td>{label(r.lang)}</td><td>{r.email ?? '—'}</td><td>{dt(r.last_prompt_at)}</td></tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <p className="az-empty">Nessuno ha ancora attivato le notifiche (Impostazioni → Beta nell'app, oppure dopo aver inviato un feedback).</p>}
    </>
  )
}

// ---------- Configurazione ----------
function Copy({ text, label: l = 'Copia' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return <button className="az-btn" onClick={() => void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000) })}>{done ? '✓ Copiato' : `📋 ${l}`}</button>
}
function Step({ n, ok, title, children }: { n: number; ok: boolean | null; title: string; children?: React.ReactNode }) {
  return (
    <div className={`az-step${ok ? ' done' : ''}`}>
      <span className="num">{ok ? '✓' : n}</span>
      <div><h4>{title} {ok === false && <span className="az-pill warn">da fare</span>}{ok && <span className="az-pill ok">fatto</span>}</h4>{!ok && children}</div>
    </div>
  )
}

export function SetupPanel({ setup, email, adminKey, onRecheck }: { setup: Setup; email: string; adminKey?: { name: string; hash: string }; onRecheck: () => void }) {
  const ref = projectRef()
  const dash = `https://supabase.com/dashboard/project/${ref}`
  // con nome + codice: si registra solo l'impronta del codice; con l'account: l'utente con questa email
  const adminSql = adminKey
    ? `insert into public.admin_keys (name, key_hash)\nvalues ('${adminKey.name.replace(/'/g, "''")}', decode('${adminKey.hash}', 'hex'))\non conflict (key_hash) do update set name = excluded.name;`
    : `insert into public.admins (user_id)\nselect id from auth.users where email = '${email}'\non conflict do nothing;`
  const fullSql = `${sql0002}\n${sql0004}\n${sql0005}\n${sql0006}\n-- tu sei l'amministratore\n${adminSql}\n`
  const step1 = !!setup.tables && setup.admin && !!setup.profiles && setup.siteFeedback !== false && setup.adminKeys !== false
  // tabelle già create ma manca qualcosa: solo i pezzi mancanti
  const partialSql = [setup.profiles === false ? sql0004 : '', setup.siteFeedback === false ? sql0005 : '', setup.adminKeys === false ? sql0006 : '', setup.admin ? '' : adminSql].filter(Boolean).join('\n')
  const cronSql = sql0003.replace('<PROJECT_REF>', ref)
  return (
    <>
      <p className="az-lead">Questa pagina controlla dal vivo cosa è già attivo sul tuo progetto Supabase. Ogni passo ha il codice già pronto:
        lo copi, lo incolli nel punto indicato e premi <b>Ricontrolla</b>.</p>
      <div className="az-steps">
        <Step n={1} ok={setup.tables == null ? null : step1} title="Tabelle (statistiche, feedback, notifiche, profili) e il tuo accesso da amministratore">
          {setup.tables
            ? <p>Manca ancora un pezzo. Copia, incolla in <a href={`${dash}/sql/new`} target="_blank" rel="noreferrer">SQL Editor</a> → <b>Run</b>.</p>
            : <p>Copia lo script (crea tutto e ti rende amministratore {adminKey ? <>con il nome <b>{adminKey.name}</b> e il tuo codice</> : <>con <b>{email}</b></>}), poi apri <a href={`${dash}/sql/new`} target="_blank" rel="noreferrer">SQL Editor</a>, incolla e premi <b>Run</b>. Deve comparire "Success".</p>}
          <div className="az-u-row"><Copy text={setup.tables ? partialSql : fullSql} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
        </Step>
        <Step n={2} ok={null} title="Registrazione con email e password">
          <p>In <a href={`${dash}/auth/providers`} target="_blank" rel="noreferrer">Authentication → Sign In / Providers → Email</a> lascia attivi
            <b>Email</b> e <b>Confirm email</b>, con <b>Email OTP Length = 6</b>: l'email contiene un codice di 6 cifre che si scrive direttamente
            nell'app installata, senza passare dal browser.</p>
          <p><b>Importante:</b> il servizio email gratuito di Supabase consegna solo agli indirizzi del tuo team (per questo a te arriva) e poche
            email all'ora. Perché arrivino anche agli amici, collega un servizio SMTP in
            <a href={`${dash}/auth/smtp`} target="_blank" rel="noreferrer">Authentication → SMTP Settings</a>. Senza dominio va bene una <b>casella Gmail
            dedicata</b> (es. quadriamo.app@gmail.com) con una "password per le app": host <code>smtp.gmail.com</code>, porta <code>587</code>,
            utente l'indirizzo Gmail, password quella per le app, nome del mittente <b>Quadriamo</b> (così non compare più "Supabase Auth").
            Con il dominio passerai a Resend (<code>smtp.resend.com</code>, porta 465, utente <code>resend</code>, password la chiave API). Finché non lo fai, puoi disattivare "Confirm email" per far entrare
            gli amici senza conferma.</p>
          <p>In <a href={`${dash}/auth/url-configuration`} target="_blank" rel="noreferrer">URL Configuration</a>: Site URL
            <code>{SITE}app/</code> e tra i Redirect URLs <code>{SITE}**</code>.</p>
          <div className="az-u-row"><Copy text={`${SITE}app/`} label="Copia Site URL" /><Copy text={`${SITE}**`} label="Copia Redirect URL" />
            <a className="az-btn" href={`${dash}/auth/providers`} target="_blank" rel="noreferrer">↗ Apri Providers</a></div>
        </Step>
        <Step n={3} ok={null} title="Email con lo stile di Quadriamo">
          <p>In <a href={`${dash}/auth/templates`} target="_blank" rel="noreferrer">Authentication → Email Templates</a>, per ognuna delle tre email
            incolla l'oggetto e il testo (scheda <b>Source</b>) e salva. Il testo esce nella lingua scelta dall'utente (IT, EN, FR, ES).</p>
          <ul className="az-tpl">
            {([['Confirm signup', 'Conferma il tuo account Quadriamo', tplConfirm], ['Magic Link', 'Il tuo accesso a Quadriamo', tplMagic],
               ['Reset Password', 'Nuova password per Quadriamo', tplRecovery]] as const).map(([name, subject, body]) => (
              <li key={name}><b>{name}</b><span className="az-u-row"><Copy text={subject} label="Copia oggetto" /><Copy text={body} label="Copia testo" /></span></li>
            ))}
          </ul>
          <div className="az-u-row"><a className="az-btn" href={`${dash}/auth/templates`} target="_blank" rel="noreferrer">↗ Apri Email Templates</a></div>
        </Step>
        <Step n={4} ok={setup.admin ? setup.fn !== 'missing' : null} title="Funzione che invia le notifiche (send-push)">
          <ol>
            <li>Apri <a href={`${dash}/functions`} target="_blank" rel="noreferrer">Edge Functions</a> → <b>Deploy a new function</b> → <b>Via Editor</b>.</li>
            <li>Nome: <code>send-push</code>. Cancella il codice di esempio, incolla quello copiato da qui → <b>Deploy</b>.</li>
            <li>Nei dettagli della funzione disattiva <b>Verify JWT</b> (serve al promemoria automatico; la funzione controlla da sola chi la chiama).</li>
          </ol>
          <div className="az-u-row"><Copy text={fnCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions`} target="_blank" rel="noreferrer">↗ Apri Edge Functions</a></div>
        </Step>
        <Step n={5} ok={setup.admin && setup.fn !== 'missing' ? setup.fn === 'ok' && setup.cronSecret : null} title="Chiavi delle notifiche (segreti)">
          <p>In <a href={`${dash}/functions/secrets`} target="_blank" rel="noreferrer">Edge Functions → Secrets</a> aggiungi tre segreti, con nomi e valori
            presi dal file <code>.vapid.local</code> nella cartella <code>quadriamo-app</code> sul tuo Mac: <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code>, <code>CRON_SECRET</code>.
            Per sicurezza non sono in questa pagina.</p>
          <div className="az-u-row"><a className="az-btn" href={`${dash}/functions/secrets`} target="_blank" rel="noreferrer">↗ Apri Secrets</a></div>
        </Step>
        <Step n={6} ok={setup.admin ? setup.reminder : null} title="Promemoria automatico ogni 10 giorni (facoltativo)">
          <ol>
            <li>In <a href={`${dash}/database/extensions`} target="_blank" rel="noreferrer">Database → Extensions</a> attiva <code>pg_cron</code> e <code>pg_net</code>.</li>
            <li>Copia lo script, sostituisci <code>&lt;CRON_SECRET&gt;</code> con il valore del file <code>.vapid.local</code>, poi eseguilo in SQL Editor.</li>
          </ol>
          <div className="az-u-row"><Copy text={cronSql} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/database/extensions`} target="_blank" rel="noreferrer">↗ Apri Extensions</a></div>
        </Step>
      </div>
      <div className="az-card">
        <h3>Altri controlli</h3>
        <ul className="az-checks">
          <li className={setup.connected ? 'ok' : 'bad'}>App collegata a Supabase</li>
          <li className={setup.vapidInApp ? 'ok' : 'bad'}>Chiave pubblica delle notifiche presente nell'app</li>
          <li className="ok">Privacy policy aggiornata con statistiche, feedback e notifiche</li>
        </ul>
      </div>
      <button className="az-btn primary" onClick={onRecheck}>↻ Ricontrolla</button>
    </>
  )
}
