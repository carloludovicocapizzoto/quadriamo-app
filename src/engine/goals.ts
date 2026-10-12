// Obiettivi di risparmio: un salvadanaio con nome, cifra da raggiungere e (se vuoi) una scadenza.
// I versamenti li segni tu: non spostano niente nelle quattro parti.
export interface GoalContribution { id: string; date: string; amount: number }   // amount < 0 = prelievo
export interface Goal {
  id: string
  name: string
  target: number
  deadline: string | null          // "YYYY-MM" (fine di quel mese) o null
  icon: string                      // nome di un'icona dell'app
  contributions: GoalContribution[]
  createdAt: string                 // "YYYY-MM-DD"
  updatedAt: string                 // ISO, per unire i dati di più dispositivi
  removed?: boolean                 // eliminato (resta come segnaposto per la sincronizzazione)
}

export interface GoalStatus {
  saved: number; left: number; pct: number; done: boolean
  monthsLeft: number | null        // mesi fino alla scadenza, compreso quello in corso
  perMonth: number | null          // quanto mettere da parte al mese per arrivarci
  onTrack: boolean | null          // in linea con il ritmo necessario (null senza scadenza)
  late: boolean                    // scadenza passata senza averlo raggiunto
}

const r2 = (n: number) => Math.round(n * 100) / 100
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1

export function goalStatus(g: Goal, today: string): GoalStatus {
  const saved = r2(g.contributions.reduce((a, c) => a + c.amount, 0))
  const left = r2(Math.max(0, g.target - saved))
  const pct = g.target > 0 ? Math.max(0, Math.min(1, saved / g.target)) : 0
  const done = saved >= g.target && g.target > 0
  if (!g.deadline) return { saved, left, pct, done, monthsLeft: null, perMonth: null, onTrack: null, late: false }
  const now = monthIndex(today.slice(0, 7)), end = monthIndex(g.deadline), start = monthIndex(g.createdAt.slice(0, 7))
  const monthsLeft = Math.max(0, end - now + 1)
  const late = !done && now > end
  const perMonth = done ? 0 : monthsLeft > 0 ? r2(left / monthsLeft) : left
  // ritmo atteso: lineare dalla creazione alla scadenza
  const span = Math.max(1, end - start + 1), elapsed = Math.min(span, Math.max(0, now - start))
  const expected = g.target * (elapsed / span)
  return { saved, left, pct, done, monthsLeft, perMonth, onTrack: done || saved >= expected - 0.005, late }
}

/**
 * Unisce gli obiettivi di due dispositivi: nome, cifra e scadenza dalla modifica più recente;
 * i versamenti si sommano (nessuno si perde se ne hai fatti da due telefoni); un obiettivo eliminato resta eliminato.
 */
export function mergeGoals(a: Goal[] | undefined, b: Goal[] | undefined): Goal[] {
  const byId = new Map<string, Goal>()
  for (const g of [...(a ?? []), ...(b ?? [])]) {
    const prev = byId.get(g.id)
    if (!prev) { byId.set(g.id, g); continue }
    const newer = g.updatedAt > prev.updatedAt ? g : prev
    const removed = !!(g.removed || prev.removed)
    const seen = new Map([...prev.contributions, ...g.contributions].map(c => [c.id, c]))
    byId.set(g.id, { ...newer, removed: removed || undefined, contributions: removed ? [] : [...seen.values()].sort((x, y) => x.date.localeCompare(y.date)) })
  }
  return [...byId.values()]
}
