// Dashboard dell'amministratore (solo per chi è nella tabella admins: lo controlla il database, non l'app).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../sync/client'
import { useSync } from '../../sync/context'

export interface Stats {
  devices: number; active_1: number; active_7: number; active_30: number; accounts: number; installed: number
  signed_in: number; with_tx: number; activated: number; avg_tx: number; push: number
  feedback_count: number; feedback_avg: number | null; retention_7: number | null; retention_30: number | null
  daily: { day: string; active: number; new: number }[] | null
  langs: Record<string, number>; platforms: Record<string, number>; events: Record<string, number>
}
export interface Feedback { id: number; created_at: string; rating: number | null; message: string | null; lang: string | null; app_version: string | null; user_id: string | null }

const LABELS: Record<string, string> = { open: 'Aperture', install: 'Installazioni', import: 'Import estratti conto', share: 'Inviti inviati',
  feedback: 'Feedback inviati', push_on: 'Notifiche attivate', it: 'Italiano', en: 'Inglese', fr: 'Francese', es: 'Spagnolo',
  ios: 'iPhone / iPad', android: 'Android', desktop: 'Computer', '?': 'Non indicato' }
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export function AdminView({ onClose }: { onClose: () => void }) {
  const sync = useSync()
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [fb, setFb] = useState<Feedback[]>([])
  const [error, setError] = useState('')
  const [push, setPush] = useState({ title: '', body: '', busy: false, result: '' })

  const load = useCallback(async () => {
    if (!supabase || !sync.user) return
    setError('')
    const [s, f] = await Promise.all([supabase.rpc('admin_stats', { p_days: days }), supabase.rpc('admin_feedback', { p_limit: 200 })])
    if (s.error || f.error) { setError('Accesso non consentito o tabelle non ancora create (esegui lo script 0002 su Supabase).'); return }
    setStats(s.data as Stats); setFb((f.data ?? []) as Feedback[])
  }, [days, sync.user])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dati dal server
  useEffect(() => { void load() }, [load])

  async function sendPush() {
    if (!supabase || !confirm(`Inviare la notifica di feedback a ${stats?.push ?? 0} dispositivi?`)) return
    setPush(p => ({ ...p, busy: true, result: '' }))
    const { data, error: e } = await supabase.functions.invoke('send-push', { body: { mode: 'manual', title: push.title || undefined, body: push.body || undefined } })
    setPush(p => ({ ...p, busy: false, result: e ? `Errore: ${e.message}. La funzione send-push è pubblicata su Supabase?`
      : `Inviate ${data.sent} su ${data.total}${data.removed ? ` · ${data.removed} iscrizioni scadute rimosse` : ''}${data.failed ? ` · ${data.failed} non riuscite` : ''}` }))
    void load()
  }

  if (!sync.user) return <Shell onClose={onClose}><p>Accedi con il tuo account (Impostazioni → Account e sincronizzazione) per vedere la dashboard.</p></Shell>
  if (error) return <Shell onClose={onClose}><p className="bad-text">{error}</p></Shell>
  if (!stats) return <Shell onClose={onClose}><p className="muted">Caricamento…</p></Shell>

  return (
    <Shell onClose={onClose} actions={
      <div className="stack-row">
        <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Periodo">
          <option value={7}>7 giorni</option><option value={30}>30 giorni</option><option value={90}>90 giorni</option>
        </select>
        <button className="btn small-btn" onClick={() => void load()}>↻ Aggiorna</button>
      </div>}>
      <AdminDashboard stats={stats} feedback={fb} days={days} push={push} setPush={setPush} onSendPush={sendPush} />
    </Shell>
  )
}

export function AdminDashboard({ stats, feedback: fb, days, push, setPush, onSendPush }: {
  stats: Stats; feedback: Feedback[]; days: number
  push: { title: string; body: string; busy: boolean; result: string }
  setPush: (f: (p: { title: string; body: string; busy: boolean; result: string }) => { title: string; body: string; busy: boolean; result: string }) => void
  onSendPush: () => void
}) {
  const daily = stats.daily ?? []
  const max = Math.max(1, ...daily.map(d => d.active))
  const funnel: [string, number][] = [['Hanno aperto l’app', stats.devices], ['Hanno registrato almeno un movimento', stats.with_tx],
    ['Attivati (6+ movimenti: stipendio e 5 spese)', stats.activated], ['Con account', stats.signed_in], ['Con notifiche attive', stats.push]]
  const kpis: [string, string, string?][] = [
    ['Dispositivi totali', String(stats.devices)], ['Attivi oggi', String(stats.active_1)], ['Attivi ultimi 7 giorni', String(stats.active_7)],
    ['Attivi ultimi 30 giorni', String(stats.active_30)], ['Account registrati', String(stats.accounts)],
    ['App installate', String(stats.installed), pct(stats.installed, stats.devices)],
    ['Tornano dopo 7 giorni', stats.retention_7 == null ? '—' : `${stats.retention_7}%`],
    ['Tornano dopo 30 giorni', stats.retention_30 == null ? '—' : `${stats.retention_30}%`],
    ['Movimenti medi per dispositivo', String(stats.avg_tx)], ['Iscritti alle notifiche', String(stats.push)],
    ['Feedback ricevuti', String(stats.feedback_count), stats.feedback_avg != null ? `voto medio ${stats.feedback_avg}/5` : undefined],
  ]
  const list = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])

  return (
    <>
      <p className="small muted">Solo dispositivi che hanno acconsentito alle statistiche anonime; gli account sono il totale degli utenti registrati.</p>
      <div className="kpis">
        {kpis.map(([l, v, s]) => <div key={l} className="kpi"><span className="muted small">{l}</span><b>{v}</b>{s && <span className="small muted">{s}</span>}</div>)}
      </div>

      <section className="card">
        <h3 className="h-plain">Accessi giornalieri · ultimi {days} giorni</h3>
        <div className="admin-chart" role="img" aria-label="Dispositivi attivi per giorno">
          {daily.map(d => (
            <div key={d.day} className="ac-col" title={`${d.day}: ${d.active} attivi, ${d.new} nuovi`}>
              <span className="ac-bar" style={{ height: `${(d.active / max) * 100}%` }}>
                <span className="ac-new" style={{ height: d.active ? `${(d.new / d.active) * 100}%` : 0 }} />
              </span>
            </div>
          ))}
        </div>
        <p className="small muted"><i className="lg lg-a" /> attivi · <i className="lg lg-n" /> di cui nuovi · {daily[0]?.day} → {daily.at(-1)?.day}</p>
      </section>

      <section className="card">
        <h3 className="h-plain">Imbuto della beta</h3>
        <ul className="funnel">
          {funnel.map(([l, n]) => (
            <li key={l}><span>{l}</span><span className="bar thin"><span style={{ width: `${stats.devices ? (n / stats.devices) * 100 : 0}%` }} /></span>
              <b>{n}</b><span className="muted small">{pct(n, stats.devices)}</span></li>
          ))}
        </ul>
      </section>

      <div className="admin-grid">
        <section className="card"><h3 className="h-plain">Lingue</h3>
          <ul className="plain">{list(stats.langs).map(([k, n]) => <li key={k}>{LABELS[k] ?? k}<b>{n}</b></li>)}</ul></section>
        <section className="card"><h3 className="h-plain">Dispositivi</h3>
          <ul className="plain">{list(stats.platforms).map(([k, n]) => <li key={k}>{LABELS[k] ?? k}<b>{n}</b></li>)}</ul></section>
        <section className="card"><h3 className="h-plain">Azioni nel periodo</h3>
          <ul className="plain">{list(stats.events).map(([k, n]) => <li key={k}>{LABELS[k] ?? k}<b>{n}</b></li>)}</ul></section>
      </div>

      <section className="card">
        <h3 className="h-plain">Notifica di feedback sui dispositivi</h3>
        <p className="small muted">Arriva a chi ha attivato le notifiche ({stats.push}). Lascia vuoto per il testo standard, nella lingua di ciascuno.</p>
        <input placeholder="Titolo (facoltativo)" value={push.title} maxLength={60} onChange={e => setPush(p => ({ ...p, title: e.target.value }))} />
        <input className="top-gap" placeholder="Testo (facoltativo)" value={push.body} maxLength={140} onChange={e => setPush(p => ({ ...p, body: e.target.value }))} />
        <div className="stack-row top-gap">
          <button className="btn primary" disabled={push.busy || !stats.push} onClick={onSendPush}>🔔 Invia notifica di feedback</button>
        </div>
        {push.result && <p className="small top-gap" role="status">{push.result}</p>}
      </section>

      <section className="card">
        <h3 className="h-plain">Feedback ({fb.length})</h3>
        {!fb.length && <p className="muted small">Ancora nessun feedback.</p>}
        <ul className="fb-list">
          {fb.map(f => (
            <li key={f.id}>
              <div className="small muted">{new Date(f.created_at).toLocaleString('it-IT')} · {LABELS[f.lang ?? '?'] ?? f.lang}{f.user_id ? ' · con account' : ''}</div>
              {f.rating != null && <div className="fb-stars" aria-label={`${f.rating} su 5`}>{'★'.repeat(f.rating)}<span>{'★'.repeat(5 - f.rating)}</span></div>}
              {f.message && <p>{f.message}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function Shell({ children, onClose, actions }: { children: React.ReactNode; onClose: () => void; actions?: React.ReactNode }) {
  return (
    <div className="admin">
      <div className="card-head">
        <h2>Dashboard beta</h2>
        <div className="stack-row">{actions}<button className="btn small-btn" onClick={onClose}>✕ Chiudi</button></div>
      </div>
      {children}
    </div>
  )
}
