/** Anello di avanzamento (0–1) che si riempie con un'animazione. */
export function Ring({ value, size = 56, stroke = 6, color = 'currentColor', track = 'rgba(127,127,127,.18)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle className="ring-v" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ ['--c' as string]: c }} />
      </svg>
      {children && <span className="ring-in">{children}</span>}
    </span>
  )
}

