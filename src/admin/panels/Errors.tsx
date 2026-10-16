// Errori dell'app sui dispositivi degli utenti (tabella client_errors, 0022 + 0024): raggruppati per messaggio,
// i più recenti in alto. Aprendo un errore: dove è successo nel codice e gli ultimi passi prima (diario tecnico).
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../sync/client'
import { Trail, type TrailRow } from './Trail'
import { dt } from './format'

interface Row {
  id: number; at: string; message: string; stack: string | null; route: string | null; version: string | null; platform: string | null
  env?: string | null; commit?: string | null; trail?: TrailRow[] | null
}

export function ErrorsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const load = () => void supabase!.from('client_errors').select('*').order('at', { ascending: false }).limit(500)
    .then(({ data, error }) => { if (error) setErr(error.message); else setRows(data as Row[]) })
  useEffect(load, [])
  const groups = useMemo(() => {
    const by = new Map<string, Row[]>()
    for (const r of rows ?? []) by.set(r.message, [...(by.get(r.message) ?? []), r])
    return [...by.entries()].map(([message, list]) => ({ message, list, last: list[0] }))
  }, [rows])
  const clear = async () => { if (!confirm('Cancellare tutti gli errori?')) return; await supabase!.from('client_errors').delete().gt('id', 0); load() }

  if (err) return <div className="az-card"><p className="az-hint">Non riesco a leggere gli errori: {err}. Hai eseguito lo script del passo 16 in Configurazione?</p></div>
  if (!rows) return <div className="az-card"><p className="az-hint">Carico…</p></div>
  return (
    <div className="az-card">
      <h3>{groups.length ? `${groups.length} errori diversi negli ultimi 30 giorni` : 'Nessun errore negli ultimi 30 giorni'}</h3>
      {groups.length > 0 && <div className="az-table-wrap"><table className="az-table">
        <thead><tr><th>Errore</th><th>Volte</th><th>Ultima</th><th>Dove</th><th>Dispositivo</th><th>Versione</th></tr></thead>
        <tbody>{groups.map(g => <Fragment key={g.message}>
          <tr className="az-row-open" onClick={() => setOpen(open === g.message ? null : g.message)}>
            <td>{g.message}</td><td>{g.list.length}</td><td>{dt(g.last.at)}</td>
            <td>{g.last.route}</td><td>{g.last.platform}</td><td>{g.last.version}{g.last.env && g.last.env !== 'production' ? ` · ${g.last.env}` : ''}</td></tr>
          {open === g.message && <tr><td colSpan={6}>
            {g.last.commit && <p className="az-hint">Codice: commit <code>{g.last.commit}</code></p>}
            <pre className="az-pre">{g.last.stack || '—'}</pre>
            {g.last.trail?.length ? <><h4 className="az-h4">Ultimi passi prima dell'errore</h4><Trail rows={g.last.trail} /></> : null}
          </td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
      <div className="az-u-row"><button className="az-btn" onClick={load}>Aggiorna</button>{groups.length > 0 && <button className="az-btn" onClick={() => void clear()}>Cancella tutti</button>}</div>
      <p className="az-hint">Solo dati tecnici: niente importi, niente movimenti, nessun dato dell'utente. Tocca un errore per vedere dove è successo nel codice e cosa è successo prima.</p>
    </div>
  )
}
