import { describe, expect, it } from 'vitest'
import { amountText, groupTyping } from './amount'
import { parseAmount } from './amount'

describe('importi mentre si scrivono', () => {
  it.each([
    ['1200', '1.200'], ['1234567', '1.234.567'], ['1.2345', '12.345'], ['1200,5', '1.200,5'], ['1200,567', '1.200,567'],
    ['1200.', '1.200,'], ['0012', '12'], [',5', '0,5'], ['', ''], ['abc', ''],
  ])('it: %s -> %s', (raw, out) => { expect(groupTyping(raw, 'it')).toBe(out) })
  it('in inglese la virgola raggruppa e il punto è il decimale', () => {
    expect(groupTyping('1200.5', 'en')).toBe('1,200.5')
    expect(groupTyping('1200,', 'en')).toBe('1,200.')
  })
  it('i decimali in più non si tagliano in silenzio: restano visibili e l’importo è rifiutato', () => {
    expect(groupTyping('0,123', 'it')).toBe('0,123')
    expect(parseAmount(groupTyping('0,123', 'it'), 'it')).toBeNull()
    expect(groupTyping('12.345', 'en')).toBe('12.345')
    expect(parseAmount(groupTyping('12.345', 'en'), 'en')).toBeNull()
    expect(parseAmount(groupTyping('0,12', 'it'), 'it')).toBe(0.12)
  })
  it('il testo scritto si rilegge come lo stesso numero', () => {
    for (const lang of ['it', 'en', 'fr', 'es']) for (const n of [0.5, 12, 1200, 1200.5, 1234567.89])
      expect(parseAmount(amountText(n, lang))).toBe(n)
  })
})
