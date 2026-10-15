// Pezzi comuni dei pannelli dell'admin: riquadri dei numeri, barre, barra degli strumenti.
export function Stat({ n, l, sub, wide }: { n: string | number; l: string; sub?: string; wide?: boolean }) {
  return <div className={`az-stat${wide ? ' wide' : ''}`}><span className="n">{n}</span><span className="l">{l}</span>{sub && <span className="sub">{sub}</span>}</div>
}
export function Bars({ items, total }: { items: [string, number][]; total?: number }) {
  const max = total ?? Math.max(1, ...items.map(i => i[1]))
  if (!items.length) return <p className="az-empty">Ancora nessun dato.</p>
  return (
    <ul className="az-bars">
      {items.map(([k, n]) => (
        <li key={k}><span className="k">{k}</span><span className="track"><span style={{ width: `${max ? (n / max) * 100 : 0}%` }} /></span><b>{n}</b></li>
      ))}
    </ul>
  )
}
export function Toolbar({ count, onExport, children }: { count: string; onExport?: () => void; children?: React.ReactNode }) {
  return (
    <div className="az-toolbar">
      <div className="az-toolbar-left">{children}</div>
      <div className="actions"><span className="az-count">{count}</span>{onExport && <button className="az-btn primary" onClick={onExport}>💾 Esporta CSV</button>}</div>
    </div>
  )
}
