// Dashboard: persone attive, accessi giornalieri, ritorno a 7 giorni per settimana, imbuto della beta.
import { label, type Cohort, type Stats } from '../data'
import { Bars, Stat } from './kit'
import { d, pct, sorted } from './format'

export function DashboardPanel({ stats, days, setDays, cohorts = [] }: { stats: Stats; days: number; setDays: (n: number) => void; cohorts?: Cohort[] }) {
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

      <div className="az-card">
        <h3>Tornano dopo 7 giorni, settimana per settimana</h3>
        <p className="az-hint">Per ogni settimana: quanti dispositivi hanno aperto Quadriamo per la prima volta e quanti sono tornati dopo almeno 7 giorni.
          È il numero che dice se il vantaggio è reale. Le ultime settimane si completano col tempo.</p>
        {cohorts.length ? <ul className="az-cohorts">
          {cohorts.map(c => {
            const p = c.new_devices ? c.back_7 / c.new_devices : 0
            return <li key={c.week} className={c.ready ? '' : 'pending'}>
              <span className="k">sett. del {d(c.week)}</span>
              <span className="track"><span style={{ width: `${p * 100}%` }} /></span>
              <b>{c.ready ? `${Math.round(p * 100)}%` : '…'}</b>
              <span className="pct">{c.back_7}/{c.new_devices}</span>
            </li>
          })}
        </ul> : <p className="az-empty">Ancora nessun dato.</p>}
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
