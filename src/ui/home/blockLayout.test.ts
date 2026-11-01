import { describe, expect, it } from 'vitest'
import { BLOCK_MIN, CHAR, amountChars, blockLayout } from './blockLayout'

describe('quattro blocchi della Home: importi leggibili (QA 1/11, 7-9 px a 320 px)', () => {
  it('il caso della QA: 320 px (fila da 280), «−2.205,64 USD»: due per riga a 15 px, non 8,9 px su quattro colonne', () => {
    expect(blockLayout(280, 16, 12)).toEqual({ cols: 2, split: true, font: 15 })   // «−247.361,500 KWD»: valuta a capo
    expect(blockLayout(280, 13, 9)).toEqual({ cols: 2, split: false, font: 15 })
  })
  it('telefono normale con euro: resta su quattro colonne quando ci sta', () => {
    expect(blockLayout(350, 8, 6).cols).toBe(4)
    expect(blockLayout(1000, 13, 9)).toMatchObject({ cols: 4, font: 15 })
  })
  it('da 280 a 1400 px e importi da 4 a 17 caratteri: mai sotto 14 px, mai più largo della colonna', () => {
    for (let width = 280; width <= 1400; width += 10) for (let full = 4; full <= 24; full++) {
      const digits = Math.max(1, full - 4), l = blockLayout(width, full, digits)
      const chars = l.split ? digits : full, column = (width - 8 * (l.cols - 1)) / l.cols
      expect(l.font).toBeGreaterThanOrEqual(BLOCK_MIN)
      expect(chars * CHAR * l.font).toBeLessThanOrEqual(column + 1e-9)
    }
  })
  it('importi enormi: la valuta va a capo per tutti e quattro, le cifre restano leggibili', () => {
    expect(blockLayout(280, 18, 14)).toMatchObject({ cols: 2, split: true })
    // «−1.234.567.890,12 USD» a 320 px: un blocco per riga piuttosto che cifre a 12 px
    expect(blockLayout(280, 21, 17)).toMatchObject({ cols: 1, split: false })
    expect(blockLayout(280, 21, 17).font).toBeGreaterThanOrEqual(BLOCK_MIN)
  })
  it('caratteri con e senza valuta, in tutte le valute e lingue: segno e decimali contano', () => {
    expect(amountChars(-447.94, 'USD', 'it')).toEqual({ full: 11, digits: 7 })
    expect(amountChars(1234567.891, 'KWD', 'en').digits).toBe('-1,234,567.891'.length - 1)
    expect(amountChars(-12345, 'JPY', 'fr').digits).toBeGreaterThanOrEqual(6)
    for (const lang of ['it', 'en', 'fr', 'es']) for (const cur of ['EUR', 'USD', 'JPY', 'KWD']) {
      const c = amountChars(-12345.678, cur, lang)
      expect(c.full).toBeGreaterThan(c.digits)
    }
  })
})
