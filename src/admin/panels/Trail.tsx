// Il diario tecnico di un dispositivo (src/app/diagnostics.ts): gli ultimi passi prima di un errore o di una segnalazione,
// con i nomi delle schermate e delle azioni come li vede l'utente.
import { ACTION_NAMES, screenName } from './screens'

export interface TrailRow { s: number; kind: string; what: string }

const KIND: Record<string, string> = { nav: 'schermata', action: 'azione', slow: 'lento', net: 'rete', error: 'errore' }
const what = (r: TrailRow) => r.kind === 'nav' && r.what.startsWith('#') ? screenName(r.what)
  : r.kind === 'action' ? ACTION_NAMES[r.what as keyof typeof ACTION_NAMES] ?? r.what : r.what

export function Trail({ rows }: { rows: TrailRow[] }) {
  return (
    <ol className="az-trail">
      {rows.map((r, i) => <li key={i} className={`k-${r.kind}`}><span className="s">{r.s.toFixed(1)} s</span><span className="k">{KIND[r.kind] ?? r.kind}</span><span className="w">{what(r)}</span></li>)}
    </ol>
  )
}
