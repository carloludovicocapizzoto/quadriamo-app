// Il contrasto dei testi si misura sui valori veri del design system: una modifica ai colori che rende
// illeggibile il testo (anche grigio) sugli sfondi delle sezioni ferma la pubblicazione. Soglia WCAG AA: 4,5.
import { describe, expect, it } from 'vitest'
import bgs from './backgrounds.css?raw'
import tokens from './tokens.css?raw'

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const all = (src: string, name: string) => [...src.matchAll(new RegExp(`--${name}: (#[0-9A-Fa-f]{6})`, 'g'))].map(m => m[1])

describe('Contrasto del design system', () => {
  const [lightText, darkText] = all(tokens, 'text'), [lightMuted, darkMuted] = all(tokens, 'muted')
  // i colori di sfondo per sezione: prima i chiari, poi gli scuri (stesso ordine in backgrounds.css)
  const surfaces = [...all(bgs, 'bg-a'), ...all(bgs, 'bg-b'), ...all(bgs, 'bg-t')]
  const isDark = (hex: string) => lum(hex) < 0.2
  it('testo e testo grigio leggibili su ogni sfondo, chiaro e scuro', () => {
    expect(surfaces.length).toBeGreaterThan(20)
    for (const s of surfaces) {
      const [text, muted] = isDark(s) ? [darkText, darkMuted] : [lightText, lightMuted]
      expect(ratio(text, s), `testo su ${s}`).toBeGreaterThanOrEqual(7)
      expect(ratio(muted, s), `grigio su ${s}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
