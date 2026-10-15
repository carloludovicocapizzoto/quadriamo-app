// Formati dei pannelli dell'admin: percentuali, date in italiano, sì/no, totali dal più grande.
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
export const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
export const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT') : '—')
export const yn = (b: boolean | null | undefined) => (b == null ? '—' : b ? 'Sì' : 'No')
export const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])
