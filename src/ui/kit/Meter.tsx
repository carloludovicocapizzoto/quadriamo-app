/** Avanzamento: una linea sottile, piena per la parte fatta (al posto degli anelli). Senza colore è inchiostro. */
export function Meter({ value, color, label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <i style={{ width: `${v * 100}%`, background: color }} />
    </span>
  )
}
