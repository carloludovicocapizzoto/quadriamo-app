// Uso dell'app (0025): schermate, tempi, percorsi, dove si esce, funzioni più e meno usate, rallentamenti ed errori.
// Solo totali e solo per le voci usate da almeno 5 dispositivi; arrivano solo da chi ha accettato le statistiche anonime.
import { useEffect, useState } from 'react'
import { loadUsage, type UsageStats } from '../data'
import { sampleUsage } from '../sample'
import { Bars, Stat } from './kit'
import { d } from './format'
import { ACTION_NAMES, screenName } from './screens'

const mins = (s: number | null | undefined) => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const action = (a: string) => ACTION_NAMES[a as keyof typeof ACTION_NAMES] ?? a

export function UsagePanel({ demo }: { demo: boolean }) {
  const [days, setDays] = useState(30)
  const [u, setU] = useState<UsageStats | null>(demo ? sampleUsage : null)
  const [err, setErr] = useState('')
  useEffect(() => { if (!demo) loadUsage(days).then(setU, e => setErr((e as Error).message)) }, [days, demo])

  if (err) return <div className="az-card"><p className="az-hint">Non riesco a leggere l'uso dell'app: {err}. Hai eseguito lo script del passo 18 in Configurazione?</p></div>
  if (!u) return <div className="az-card"><p className="az-hint">Carico…</p></div>
  const note = <p className="az-hint">Arriva solo da chi ha accettato le statistiche anonime: secondi per schermata, percorsi, tipi di azione. Mai importi, testi o nomi. Ogni voce compare da {u.min} dispositivi in su.</p>
  if (u.devices < u.min) return <>
    <div className="az-card az-locked-info"><h3>Servono almeno {u.min} dispositivi</h3>
      <p>Finora ne sono arrivati <b>{u.devices}</b> in questo periodo. Con meno dati una persona potrebbe essere riconosciuta.</p></div>
    {note}
  </>

  const daily = u.daily ?? []
  const max = Math.max(1, ...daily.map(x => x.sessions))
  const actions = u.actions ?? []   // dalla meno usata
  return <>
    <div className="az-stat-grid">
      <Stat wide n={u.sessions ?? 0} l="Sessioni" sub={`da ${u.devices} dispositivi`} />
      <Stat n={mins(u.median_seconds)} l="Durata tipica di una sessione" />
      <Stat n={u.error_share == null ? '—' : `${100 - u.error_share}%`} l="Sessioni senza errori" />
      <Stat n={u.slow_share == null ? '—' : `${u.slow_share}%`} l="Sessioni con rallentamenti" sub="attese oltre 200 ms" />
    </div>

    <div className="az-card">
      <div className="az-card-head">
        <h3>Sessioni al giorno</h3>
        <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Periodo">
          <option value={7}>Ultimi 7 giorni</option><option value={30}>Ultimi 30 giorni</option><option value={90}>Ultimi 90 giorni</option>
        </select>
      </div>
      <div className="az-chart" role="img" aria-label="Sessioni per giorno">
        {daily.map(x => <div key={x.day} className="col" title={`${d(x.day)}: ${x.sessions} sessioni`}><span className="bar" style={{ height: `${(x.sessions / max) * 100}%` }} /></div>)}
      </div>
    </div>

    <div className="az-card">
      <h3>Schermate</h3>
      <div className="az-table-wrap"><table className="az-table">
        <thead><tr><th>Schermata</th><th>Dispositivi</th><th>Sessioni</th><th>Tempo medio</th></tr></thead>
        <tbody>{(u.screens ?? []).map(s => <tr key={s.screen}><td>{screenName(s.screen)}</td><td>{s.devices}</td><td>{s.sessions}</td><td>{mins(s.avg_seconds)}</td></tr>)}</tbody>
      </table></div>
    </div>

    <div className="az-cols">
      <div className="az-card"><h3>Percorsi più frequenti</h3><Bars items={(u.paths ?? []).map(p => [`${screenName(p.from)} → ${screenName(p.to)}`, p.times])} /></div>
      <div className="az-card"><h3>Dove finisce la sessione</h3><Bars items={(u.exits ?? []).map(e => [screenName(e.screen), e.sessions])} /></div>
      <div className="az-card"><h3>Funzioni, dalla più usata</h3>
        <Bars items={[...actions].reverse().map(a => [`${action(a.action)} · ${a.devices} disp.`, a.times])} />
        <p className="az-hint">In fondo le funzioni che quasi nessuno usa: da semplificare, spiegare meglio o togliere.</p></div>
    </div>
    {note}
  </>
}
