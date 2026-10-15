// Ricerca anonima: solo totali, e solo da 5 schede in su.
import { label, type ResearchStats } from '../data'
import { Bars, Stat } from './kit'
import { pct, sorted } from './format'

export function ResearchPanel({ r, buckets = ['Essenziali', 'Qualità della vita', 'Fondo di sicurezza', 'Investimenti'] }: { r: ResearchStats; buckets?: string[] }) {
  const items = (o: Record<string, number> = {}) => sorted(o).map(([k, n]) => [label(k), n] as [string, number])
  const order = ['lt1000', '1000-1500', '1500-2000', '2000-3000', 'ge3000']
  const bands = order.filter(k => r.income_bands?.[k]).map(k => [label(k), r.income_bands![k]] as [string, number])
  const inv = r.invested ?? {}
  const invTot = (inv.yes ?? 0) + (inv.want ?? 0) + (inv.no ?? 0)
  const note = <p className="az-hint">Schede inviate per scelta degli utenti, senza nome, email né account; entrate solo per fascia. Le risposte dei singoli non sono visibili e non sono collegate agli account.</p>
  if (r.answers < r.min) {
    return (
      <>
        <div className="az-card az-locked-info">
          <h3>Servono almeno {r.min} schede anonime</h3>
          <p>Finora ne sono arrivate <b>{r.answers}</b>. I totali compaiono da {r.min} in su: con meno risposte una persona potrebbe essere riconosciuta.</p>
        </div>
        {note}
      </>
    )
  }
  return (
    <>
      <div className="az-stat-grid">
        <Stat n={r.answers} l="Schede anonime ricevute" />
        <Stat n={pct(inv.yes ?? 0, invTot)} l="Ha già investito" sub={invTot ? `${pct(inv.want ?? 0, invTot)} vorrebbe iniziare` : undefined} />
        <Stat n={r.shares_custom ?? 0} l="Hanno cambiato la regola 55-20-15-10" sub={`${r.shares_default ?? 0} la tengono`} />
      </div>
      <div className="az-cols">
        <div className="az-card"><h3>Entrate mensili nette (fasce)</h3><Bars items={bands} /></div>
        <div className="az-card"><h3>Per cosa usano Quadriamo</h3><Bars items={items(r.goals)} total={Math.max(1, r.answers)} /></div>
        <div className="az-card"><h3>Carte e conti</h3><Bars items={items(r.cards)} total={Math.max(1, r.answers)} /></div>
        <div className="az-card"><h3>Investimenti</h3><Bars items={items(r.invested)} />
          {Object.keys(r.invest_where ?? {}).length > 0 && <><h3 className="az-h3">Dove investono</h3><Bars items={items(r.invest_where)} /></>}</div>
        <div className="az-card"><h3>Divisione media scelta</h3>
          {r.shares_avg?.length === 4
            ? <Bars items={r.shares_avg.map((v, i) => [`${buckets[i]} (${String(v).replace('.', ',')}%)`, v] as [string, number])} total={100} />
            : <p className="az-empty">Ancora nessun dato.</p>}</div>
      </div>
      {note}
    </>
  )
}
