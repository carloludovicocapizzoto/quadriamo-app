// La ricevuta come elenco di righe a larghezza fissa (W caratteri, carattere monospaziato): la stessa descrizione
// diventa la pagina (Receipt.tsx) e l'immagine da condividere (draw.ts), così le due sono sempre identiche.
import type { Receipt } from '../../engine'
import type { Dict } from '../../i18n/en'

export const W = 32
export type Line =
  | { t: 'center'; text: string; big?: boolean; dim?: boolean }
  | { t: 'row'; left: string; right: string; bold?: boolean; dim?: boolean }
  | { t: 'rule'; dash?: boolean }
  | { t: 'bar'; left: string; share: number; right: string }
  | { t: 'text'; text: string; dim?: boolean }
  | { t: 'barcode'; seed: string }
  | { t: 'gap' }

type T = (k: keyof Dict, v?: Record<string, string | number>) => string

/** Spezza un testo in righe di al massimo `w` caratteri, a parole. */
export function wrap(text: string, w = W): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (!word) continue
    if ((line ? line.length + 1 : 0) + word.length > w) { if (line) out.push(line); line = word.slice(0, w) }
    else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}
const fit = (left: string, right: string) => left.length + right.length + 1 > W ? left.slice(0, Math.max(1, W - right.length - 2)) + '…' : left

export function receiptLines(r: Receipt, i: {
  t: T; money: (n: number) => string; num: (n: number) => string; monthName: string; prevName: string | null
  day: (iso: string) => string; catName: (id: string) => string; bucketName: (id: string) => string
}): Line[] {
  const { t, money, num } = i
  const up = (s: string) => s.toLocaleUpperCase()
  const L: Line[] = [
    { t: 'center', text: 'QUADRIAMO.', big: true },
    { t: 'center', text: up(t('rc.subtitle')), dim: true },
    { t: 'rule', dash: true },
    { t: 'row', left: up(t('rc.number')), right: `${r.ym.year}/${String(r.ym.month).padStart(2, '0')}` },
    { t: 'row', left: up(t('rc.month')), right: up(i.monthName) },
    { t: 'rule', dash: true },
  ]
  for (const l of r.lines.slice(0, 10)) {
    const right = num(l.amount)
    L.push({ t: 'row', left: fit(`${l.count > 1 ? `${l.count}× ` : ''}${up(i.catName(l.category.id))}`, right), right })
  }
  if (r.lines.length > 10) {
    const rest = r.lines.slice(10).reduce((a, l) => a + l.amount, 0)
    L.push({ t: 'row', left: up(t('rc.others', { n: r.lines.length - 10 })), right: num(rest), dim: true })
  }
  if (!r.lines.length) L.push({ t: 'center', text: up(t('rc.noSpending')), dim: true })
  L.push({ t: 'rule' },
    { t: 'row', left: up(t('rc.income')), right: num(r.income) },
    { t: 'row', left: up(t('rc.spent')), right: num(r.spent) },
    { t: 'row', left: up(t('rc.saved')), right: num(r.saved) })
  if (r.invested > 0) L.push({ t: 'row', left: `  ${up(t('rc.invested'))}`, right: num(r.invested), dim: true })
  L.push({ t: 'rule' }, { t: 'row', left: up(r.closed ? t('rc.left') : t('rc.leftSoFar')), right: money(r.leftOver), bold: true }, { t: 'rule' })
  if (r.prev && i.prevName) {
    const sign = r.prev.diff > 0 ? '+' : ''
    L.push({ t: 'row', left: up(t('rc.vs', { month: i.prevName })), right: `${sign}${num(r.prev.diff)}${r.prev.pct != null ? ` (${sign}${r.prev.pct}%)` : ''}` })
  }
  if (r.top) { const left = up(t('rc.top')); L.push({ t: 'row', left, right: up(i.catName(r.top.category.id)).slice(0, Math.max(4, W - left.length - 1)) }) }
  if (r.buckets.some(b => b.spent > 0)) {
    L.push({ t: 'rule', dash: true }, { t: 'center', text: up(t('rc.byPart')), dim: true })
    for (const b of r.buckets) L.push({ t: 'bar', left: fit(up(i.bucketName(b.id)), num(b.spent)), share: b.share, right: num(b.spent) })
  }
  if (r.curiosities.length) {
    L.push({ t: 'rule', dash: true }, { t: 'center', text: up(t('rc.facts')), dim: true })
    for (const c of r.curiosities) {
      const text = c.id === 'priciestDay' ? t('rc.c.priciestDay', { day: i.day(c.date), amount: money(c.amount) })
        : c.id === 'daysLogged' ? t('rc.c.daysLogged', { n: c.days, of: c.of })
        : c.id === 'savedShare' ? t('rc.c.savedShare', { pct: c.pct })
        : c.id === 'smallOnes' ? t('rc.c.smallOnes', { n: c.count, amount: money(c.amount) })
        : t('rc.c.biggest', { name: c.description, amount: money(c.amount) })
      wrap(text, W - 2).forEach((line, j) => L.push({ t: 'text', text: `${j ? '  ' : '· '}${line}` }))
    }
  }
  L.push({ t: 'rule', dash: true }, { t: 'center', text: up(r.closed ? t('rc.thanks') : t('rc.inProgress')) }, { t: 'gap' },
    { t: 'barcode', seed: `${r.ym.year}${r.ym.month}${Math.round(r.spent)}` },
    { t: 'center', text: `*${r.ym.year}${String(r.ym.month).padStart(2, '0')}${r.count}*`, dim: true },
    { t: 'center', text: t('rc.private'), dim: true })
  return L
}

/** Le barre di un codice a barre decorativo, sempre uguali per lo stesso mese (larghezze 1–3). */
export function barcode(seed: string, n = 46): number[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return Array.from({ length: n }, () => { h = Math.imul(h ^ (h >>> 13), 1274126177); return 1 + ((h >>> 0) % 3) })
}
