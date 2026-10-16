// Segnalazioni dei tester (0026): bug e idee con priorità, allegati, diagnostica e ultimi passi.
// Si aprono una alla volta; "Vista" e "Risolta" tengono il conto di cosa resta da fare.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { attachmentUrls, deleteReport, dropOldAttachments, loadReports, setReportStatus, type Report } from '../data'
import { sampleReports } from '../sample'
import { dt } from './format'
import { screenName } from './screens'
import { Trail } from './Trail'

const KIND = { bug: 'Problema', idea: 'Idea' }
const PRIORITY = { blocking: 'Bloccante', high: 'Alta', normal: 'Normale', low: 'Bassa' }
const STATUS = { new: 'Nuova', seen: 'Vista', done: 'Risolta' }
const RANK = { blocking: 0, high: 1, normal: 2, low: 3 }

export function ReportsPanel({ demo }: { demo: boolean }) {
  const [rows, setRows] = useState<Report[] | null>(demo ? sampleReports : null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [show, setShow] = useState<'open' | 'done' | 'all'>('open')
  const [open, setOpen] = useState<string | null>(null)
  const load = () => {
    if (demo) return
    loadReports().then(async r => {
      const dropped = await dropOldAttachments(r).catch(() => 0)
      if (dropped) { setNote(`Cancellati gli allegati di ${dropped} segnalazioni più vecchie di 90 giorni.`); r = await loadReports() }
      setRows(r)
    }, e => setErr((e as Error).message))
  }
  useEffect(load, [demo])   // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (rows ?? [])
    .filter(r => show === 'all' || (show === 'done' ? r.status === 'done' : r.status !== 'done'))
    .sort((a, b) => show === 'open' ? RANK[a.priority] - RANK[b.priority] || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)),
  [rows, show])
  const update = async (r: Report, status: Report['status']) => {
    if (!demo) await setReportStatus(r.id, status)
    setRows(rs => rs!.map(x => x.id === r.id ? { ...x, status } : x))
  }
  const remove = async (r: Report) => {
    if (!confirm('Eliminare la segnalazione e i suoi allegati?')) return
    if (!demo) await deleteReport(r)
    setRows(rs => rs!.filter(x => x.id !== r.id))
  }

  if (err) return <div className="az-card"><p className="az-hint">Non riesco a leggere le segnalazioni: {err}. Hai eseguito lo script del passo 18 in Configurazione?</p></div>
  if (!rows) return <div className="az-card"><p className="az-hint">Carico…</p></div>
  const waiting = rows.filter(r => r.status === 'new').length
  return (
    <div className="az-card">
      <div className="az-card-head">
        <h3>{waiting ? `${waiting} segnalazioni nuove` : 'Nessuna segnalazione nuova'}</h3>
        <select value={show} onChange={e => setShow(e.target.value as typeof show)} aria-label="Quali segnalazioni">
          <option value="open">Da fare</option><option value="done">Risolte</option><option value="all">Tutte</option>
        </select>
      </div>
      {note && <p className="az-msg ok">{note}</p>}
      {list.length > 0 && <div className="az-table-wrap"><table className="az-table">
        <thead><tr><th>Priorità</th><th>Tipo</th><th>Segnalazione</th><th>Quando</th><th>Versione</th><th>Stato</th></tr></thead>
        <tbody>{list.map(r => <Fragment key={r.id}>
          <tr className={`az-row-open${r.status === 'new' ? ' is-new' : ''}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
            <td><span className={`az-pill${r.priority === 'blocking' || r.priority === 'high' ? ' warn' : ''}`}>{PRIORITY[r.priority]}</span></td>
            <td>{KIND[r.kind]}</td><td className="wrap">{r.message.length > 120 ? `${r.message.slice(0, 120)}…` : r.message}</td>
            <td>{dt(r.created_at)}</td><td>{r.version ?? '—'}{r.env && r.env !== 'production' ? ` · ${r.env}` : ''}</td><td>{STATUS[r.status]}</td>
          </tr>
          {open === r.id && <tr><td colSpan={6}><ReportDetail r={r} demo={demo} onStatus={s => void update(r, s)} onDelete={() => void remove(r)} /></td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
      {!list.length && <p className="az-empty">Niente da mostrare qui.</p>}
      <div className="az-u-row"><button className="az-btn" onClick={load}>Aggiorna</button></div>
      <p className="az-hint">Arrivano dalla pagina "Segnala un problema" dell'app beta. Gli allegati si cancellano da soli dopo 90 giorni.</p>
    </div>
  )
}

function ReportDetail({ r, demo, onStatus, onDelete }: { r: Report; demo: boolean; onStatus: (s: Report['status']) => void; onDelete: () => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [urlErr, setUrlErr] = useState(false)
  useEffect(() => { if (!demo) attachmentUrls(r.attachments).then(setUrls, () => setUrlErr(true)) }, [r.attachments, demo])
  useEffect(() => { if (r.status === 'new') onStatus('seen') }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const d = r.diagnostics
  return (
    <div className="az-report">
      {r.message.length > 120 && <p className="az-report-msg">{r.message}</p>}
      {r.email && <p className="az-hint">Da <a href={`mailto:${r.email}`}>{r.email}</a></p>}
      {r.attachments.length > 0 && <div className="az-report-files">
        {urlErr ? <p className="az-hint">Non riesco ad aprire gli allegati: entra nell'area amministratore con l'account (non con il codice).</p>
          : r.attachments.map(p => urls[p] && (/\.(mp4|mov|webm)$/.test(p)
            ? <video key={p} src={urls[p]} controls playsInline /> : <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt="Allegato" /></a>))}
      </div>}
      {d && <>
        <h4 className="az-h4">Dispositivo</h4>
        <p className="az-hint">{[d.os, d.installed ? 'app installata' : 'nel browser', d.screen, d.lang, d.online === false ? 'offline' : null, d.timeZone].filter(Boolean).join(' · ')}<br />
          Versione {d.release}{d.commit ? ` (commit ${d.commit})` : ''} · {d.env} · schermata {d.route ? screenName(d.route) : '—'} · {d.at ? dt(d.at) : ''}</p>
        {d.trail?.length ? <><h4 className="az-h4">Ultimi passi</h4><Trail rows={d.trail} /></> : null}
      </>}
      <div className="az-u-row">
        {r.status !== 'done' ? <button className="az-btn primary" onClick={() => onStatus('done')}>✓ Risolta</button>
          : <button className="az-btn" onClick={() => onStatus('seen')}>Riapri</button>}
        <button className="az-btn" onClick={onDelete}>Elimina</button>
      </div>
    </div>
  )
}
