// Account registrati: ricerca per nome o email, esportazione.
import { useState } from 'react'
import { downloadCsv, type Account } from '../data'
import { Toolbar } from './kit'
import { d, dt, yn } from './format'

export function AccountsPanel({ rows }: { rows: Account[] }) {
  const [q, setQ] = useState('')
  const list = rows.filter(r => !q || `${r.email} ${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Toolbar count={`${list.length} account`} onExport={() => downloadCsv('quadriamo-account', [
        ['Nome', 'Cognome', 'Email', 'Iscritto il', 'Ultimo accesso', 'Notifiche', 'Feedback'],
        ...list.map(r => [r.first_name, r.last_name, r.email, r.created_at, r.last_sign_in_at, yn(r.has_push), r.feedback_count])])}>
        <input className="az-search" placeholder="Cerca per nome o email…" value={q} onChange={e => setQ(e.target.value)} />
      </Toolbar>
      <div className="az-table-wrap">
        <table className="az-table">
          <thead><tr><th>Nome</th><th>Email</th><th>Iscritto il</th><th>Ultimo accesso</th><th>Notifiche</th><th>Feedback</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.email}><td>{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td><td>{r.email}</td><td>{d(r.created_at)}</td><td>{dt(r.last_sign_in_at)}</td>
                <td>{r.has_push ? <span className="az-pill ok">Attive</span> : '—'}</td><td>{r.feedback_count || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="az-empty">Nessun account{rows.length ? ' con questa ricerca' : ' registrato finora'}.</p>}
    </>
  )
}
