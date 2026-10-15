// Notifiche: iscritti e invio manuale della notifica di feedback.
import { useState } from 'react'
import { label, type PushSub, type Setup } from '../data'
import { Stat } from './kit'
import { d, dt } from './format'

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
