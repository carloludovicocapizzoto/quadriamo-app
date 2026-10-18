import { describe, expect, it } from 'vitest'
import { decimalText, parseDecimal } from './decimal'

describe('quantità e prezzi frazionari', () => {
  it.each([['0,123456', 0.123456], ['0.12345678', 0.12345678], ['1,234', 1.234], ['1.234', 1.234]])('%s conserva tutti i decimali', (raw, value) => {
    expect(parseDecimal(raw)).toBe(value)
  })
  it.each(['', 'abc', '1-2', '1,2,3', '1.2.3', '1e309'])('rifiuta %s', raw => {
    expect(parseDecimal(raw)).toBeNull()
  })
  it.each(['it', 'en', 'fr', 'es'])('%s: formattazione e lettura mantengono la precisione', lang => {
    for (const n of [0.12345678, 1.234, 123456.789012, 1e-8, 1e-24, 1.2345678901234567]) expect(parseDecimal(decimalText(n, lang))).toBe(n)
  })
  it.each([['1.234,56789', 1234.56789], ['1,234.56789', 1234.56789], ['1 234,56789', 1234.56789], ['12.500.000', 12500000], ['12,500,000', 12500000]])('mantiene l’incolla con raggruppamento %s', (raw, n) => {
    expect(parseDecimal(raw)).toBe(n)
  })
})
