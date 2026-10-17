// La ricevuta come immagine (PNG) da condividere o salvare: le stesse righe della pagina (model.ts), disegnate su un
// canvas con un carattere monospaziato, su carta chiara con i bordi seghettati. Tutto sul telefono: nessun servizio esterno.
import { W, barcode, type Line } from './model'

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
const PAPER = '#FBFAF6', INK = '#17181A', DIM = '#74767B', BG = '#E9E5DC', ACCENT = '#C2410C'

export async function receiptImage(lines: Line[]): Promise<Blob> {
  await document.fonts?.ready
  const width = 1080, paperW = 860, pad = 56
  const inner = paperW - pad * 2
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = `40px ${MONO}`
  const size = 40 * (inner / W) / probe.measureText('0').width   // W caratteri riempiono la riga
  const lh = Math.round(size * 1.55)
  const heightOf = (l: Line) => l.t === 'gap' ? lh / 2 : l.t === 'bar' ? lh * 1.6 : l.t === 'barcode' ? lh * 2.2 : l.t === 'rule' ? lh * 0.8 : l.t === 'center' && l.big ? lh * 1.9 : lh
  const paperH = pad * 2 + lines.reduce((a, l) => a + heightOf(l), 0)
  const height = paperH + 160
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  const g = c.getContext('2d')!
  g.fillStyle = BG; g.fillRect(0, 0, width, height)
  // la carta, con il bordo seghettato sopra e sotto
  const x0 = (width - paperW) / 2, y0 = 80, tooth = 14
  g.fillStyle = PAPER
  g.beginPath(); g.moveTo(x0, y0 + tooth)
  for (let x = x0; x < x0 + paperW; x += tooth * 2) { g.lineTo(x + tooth, y0); g.lineTo(x + tooth * 2, y0 + tooth) }
  g.lineTo(x0 + paperW, y0 + paperH - tooth)
  for (let x = x0 + paperW; x > x0; x -= tooth * 2) { g.lineTo(x - tooth, y0 + paperH); g.lineTo(x - tooth * 2, y0 + paperH - tooth) }
  g.closePath(); g.fill()

  let y = y0 + pad
  const left = x0 + pad, right = x0 + paperW - pad
  for (const l of lines) {
    const h = heightOf(l)
    const mid = y + h / 2
    g.textBaseline = 'middle'
    g.fillStyle = INK
    g.font = `${size}px ${MONO}`
    switch (l.t) {
      case 'center':
        if (l.big) { g.font = `${Math.round(size * 2)}px "DM Serif Display", Georgia, serif`; g.textAlign = 'center'; g.fillText(l.text.replace(/\.$/, ''), width / 2 - size * 0.35, mid)
          const w = g.measureText(l.text.replace(/\.$/, '')).width; g.fillStyle = ACCENT; g.fillText('.', width / 2 - size * 0.35 + w / 2 + size * 0.3, mid); break }
        g.fillStyle = l.dim ? DIM : INK; g.textAlign = 'center'; g.fillText(l.text, width / 2, mid); break
      case 'row':
        g.fillStyle = l.dim ? DIM : INK
        if (l.bold) g.font = `bold ${size * 1.12}px ${MONO}`
        g.textAlign = 'left'; g.fillText(l.left, left, mid); g.textAlign = 'right'; g.fillText(l.right, right, mid); break
      case 'text':
        g.fillStyle = l.dim ? DIM : INK; g.textAlign = 'left'; g.fillText(l.text, left, mid); break
      case 'rule':
        g.strokeStyle = INK; g.lineWidth = 2; g.setLineDash(l.dash ? [6, 8] : []); g.beginPath(); g.moveTo(left, mid); g.lineTo(right, mid); g.stroke(); g.setLineDash([]); break
      case 'bar': {
        const top = y + lh / 2
        g.textAlign = 'left'; g.fillText(l.left, left, top); g.textAlign = 'right'; g.fillText(l.right, right, top)
        const by = y + lh * 0.95, bh = size * 0.42
        g.fillStyle = 'rgba(23,24,26,.10)'; g.fillRect(left, by, right - left, bh)
        g.fillStyle = INK; g.fillRect(left, by, (right - left) * l.share, bh)
        break
      }
      case 'barcode': {
        const bars = barcode(l.seed), unit = 4, total = bars.reduce((a, b) => a + b * unit + unit, 0)
        let x = width / 2 - total / 2
        g.fillStyle = INK
        for (const b of bars) { g.fillRect(x, y + h * 0.1, b * unit, h * 0.8); x += b * unit + unit }
        break
      }
      case 'gap': break
    }
    y += h
  }
  g.textAlign = 'center'; g.fillStyle = DIM; g.font = `${size * 0.85}px ${MONO}`
  g.fillText('quadriamo', width / 2, y0 + paperH + 50)
  return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('canvas')), 'image/png'))
}
