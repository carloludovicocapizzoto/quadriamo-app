// Treemap "squarified" (Bruls, Huizing, van Wijk 2000): ogni valore diventa un rettangolo con l'area proporzionale,
// il più possibile vicino a un quadrato, così i blocchi si leggono e si toccano bene anche quando sono piccoli.
// Coordinate in percentuale (0–100) del contenitore: il disegno le usa così come sono, a qualunque larghezza.
export interface Tile { id: string; x: number; y: number; w: number; h: number }

interface Rect { x: number; y: number; w: number; h: number }

/** Il rapporto peggiore (lato lungo / lato corto) di una riga disposta lungo il lato `side`. */
function worst(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0)
  if (!sum) return Infinity
  const max = Math.max(...row), min = Math.min(...row)
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

/** Dispone gli elementi (valori > 0) dal più grande, in un rettangolo 100×`height`. */
export function treemap(items: { id: string; value: number }[], height = 100): Tile[] {
  const list = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value)
  const total = list.reduce((a, i) => a + i.value, 0)
  if (!total) return []
  const scale = (100 * height) / total
  const areas = list.map(i => ({ id: i.id, a: i.value * scale }))
  const out: Tile[] = []
  let rect: Rect = { x: 0, y: 0, w: 100, h: height }
  let i = 0
  while (i < areas.length) {
    const side = Math.min(rect.w, rect.h)
    const row = [areas[i]]
    i++
    while (i < areas.length && worst([...row, areas[i]].map(r => r.a), side) <= worst(row.map(r => r.a), side)) { row.push(areas[i]); i++ }
    // la riga occupa una striscia lungo il lato corto
    const sum = row.reduce((a, r) => a + r.a, 0)
    if (rect.w >= rect.h) {
      const w = sum / rect.h
      let y = rect.y
      for (const r of row) { const h = r.a / w; out.push({ id: r.id, x: rect.x, y, w, h }); y += h }
      rect = { x: rect.x + w, y: rect.y, w: rect.w - w, h: rect.h }
    } else {
      const h = sum / rect.w
      let x = rect.x
      for (const r of row) { const w = r.a / h; out.push({ id: r.id, x, y: rect.y, w, h }); x += w }
      rect = { x: rect.x, y: rect.y + h, w: rect.w, h: rect.h - h }
    }
  }
  return out
}
