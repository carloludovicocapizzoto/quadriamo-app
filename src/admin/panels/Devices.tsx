// Dispositivi: un codice casuale per telefono, con filtri ed esportazione.
import { useState } from 'react'
import { downloadCsv, label, type Device } from '../data'
import { Toolbar } from './kit'
import { d, yn } from './format'

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
