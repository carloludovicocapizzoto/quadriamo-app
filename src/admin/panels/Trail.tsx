// Il diario tecnico di un dispositivo (src/app/diagnostics.ts): gli ultimi passi prima di un errore o di una segnalazione.
export interface TrailRow { s: number; kind: string; what: string }

const KIND: Record<string, string> = { nav: 'schermata', action: 'azione', slow: 'lento', net: 'rete', error: 'errore' }

export function Trail({ rows }: { rows: TrailRow[] }) {
  return (
    <ol className="az-trail">
      {rows.map((r, i) => <li key={i} className={`k-${r.kind}`}><span className="s">{r.s.toFixed(1)} s</span><span className="k">{KIND[r.kind] ?? r.kind}</span><span className="w">{r.what}</span></li>)}
    </ol>
  )
}
