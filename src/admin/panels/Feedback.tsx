// Feedback: voto medio, alternative, distribuzione dei voti e risposte una per una.
import { useState } from 'react'
import { downloadCsv, label, type Feedback } from '../data'
import { Bars, Toolbar } from './kit'
import { dt, sorted, yn } from './format'

export function FeedbackPanel({ rows, alternatives = {} }: { rows: Feedback[]; alternatives?: Record<string, number> }) {
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
          <h3>Se non ci fosse Quadriamo userebbero…</h3>
          <Bars items={sorted(alternatives).map(([k, n]) => [label(k), n])} />
        </div>
        <div className="az-card">
          <h3>Distribuzione dei voti</h3>
          <Bars items={[5, 4, 3, 2, 1].map(s => [`${'★'.repeat(s)}`, rated.filter(r => r.rating === s).length])} total={Math.max(1, rated.length)} />
        </div>
      </div>
      <Toolbar count={`${list.length} risposte`} onExport={() => downloadCsv('quadriamo-feedback', [
        ['Data', 'Da', 'Voto', 'Commento', 'Al posto di Quadriamo', 'Email', 'Lingua', 'Versione', 'Con account'],
        ...list.map(r => [r.created_at, r.source === 'site' ? 'Sito' : 'App', r.rating, r.message, r.alternative ? `${label(r.alternative)}${r.alternative_other ? `: ${r.alternative_other}` : ''}` : '', r.email, label(r.lang), r.app_version, yn(!!r.user_id)])])}>
        <select value={stars} onChange={e => setStars(Number(e.target.value))} aria-label="Filtra per voto">
          <option value={0}>Tutti i voti</option>{[5, 4, 3, 2, 1].map(s => <option key={s} value={s}>{s} stelle</option>)}
        </select>
      </Toolbar>
      <div className="az-table-wrap">
        <table className="az-table">
          <thead><tr><th>Data</th><th>Da</th><th>Voto</th><th>Commento</th><th>Al posto di Quadriamo</th><th>Email</th><th>Lingua</th><th>Versione</th><th>Account</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}><td>{dt(r.created_at)}</td><td>{r.source === 'site' ? <span className="az-pill warn">Sito</span> : 'App'}</td>
                <td className="stars">{r.rating ? <>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></> : '—'}</td>
                <td className="wrap">{r.message ?? '—'}</td><td>{r.alternative ? `${label(r.alternative)}${r.alternative_other ? `: ${r.alternative_other}` : ''}` : '—'}</td><td>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : '—'}</td><td>{label(r.lang)}</td><td>{r.app_version ?? '—'}</td><td>{r.user_id ? 'Sì' : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="az-empty">Nessuna risposta{rows.length ? ' con questo voto' : ' ricevuta finora'}.</p>}
    </>
  )
}
