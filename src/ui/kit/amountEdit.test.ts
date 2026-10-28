import { describe, expect, it } from 'vitest'
import { editAmount, groupTyping, parseAmount, pastedAmount, unreadableAmount } from './amount'

// Regressioni P1.1 (review Codex): l'incolla e la digitazione non cambiano mai l'importo togliendo caratteri.
const LANGS = ['it', 'en', 'fr', 'es'] as const
const typeAll = (keys: string, lang: string, start = '') => {
  let text = start
  for (const ch of keys) { const raw = text + ch; text = editAmount(text, raw, lang, { kind: 'type', data: ch, caret: raw.length }) }
  return text
}
const value = (text: string, lang: string) => parseAmount(text, lang)

describe('P1.1: importi incollati', () => {
  it('riproduzione: prima l’incolla passava da groupTyping e «2.35» diventava 235', () => {
    expect(groupTyping('2.35', 'it')).toBe('235')             // il comportamento vecchio della funzione di digitazione
    expect(value(editAmount('', '2.35', 'it', { kind: 'insert' }), 'it')).toBe(2.35)
  })
  it.each([
    // incollato, lingua, valore atteso (null = rifiutato e lasciato visibile così com'è)
    ['2.35', 'it', 2.35], ['2,35', 'it', 2.35], ['1.234', 'it', 1234], ['1,234', 'it', null], ['1.234,56', 'it', 1234.56],
    ['1,234.56', 'it', 1234.56], ['0,123', 'it', null], ['0.123', 'it', null], ['-2.35', 'it', -2.35], ['-1.234,56', 'it', -1234.56],
    ['2.35', 'en', 2.35], ['2,35', 'en', 2.35], ['1.234', 'en', null], ['1,234', 'en', 1234], ['1,234.56', 'en', 1234.56],
    ['1.234,56', 'en', 1234.56], ['0.123', 'en', null], ['-1,234.56', 'en', -1234.56],
    ['2.35', 'fr', 2.35], ['1 234,56', 'fr', 1234.56], ['1 234,56', 'fr', 1234.56], ['0,123', 'fr', null],
    ['2.35', 'es', 2.35], ['1.234,56', 'es', 1234.56], ['1,234', 'es', null], [' 12,50 € ', 'it', 12.5],
  ] as const)('%s in %s → %s', (pasted, lang, want) => {
    const text = editAmount('', pasted, lang, { kind: 'insert' })
    expect(value(text, lang)).toBe(want)
    if (want == null) { expect(text).toBe(pasted.trim()); expect(unreadableAmount(text, lang)).toBe(true) }
    else expect(unreadableAmount(text, lang)).toBe(false)
  })
  it('nessuna cifra si perde: un incollato non leggibile resta intero', () => {
    for (const lang of LANGS) for (const p of ['0.123', '1.2.3', '12.345,678', '2..35'])
      expect(pastedAmount(p, lang).replace(/\D/g, '')).toBe(p.replace(/\D/g, ''))
  })
  it('dopo un incollato rifiutato, scrivere non rimette in ordine (cambierebbe l’importo)', () => {
    expect(typeAll('4', 'it', '0.123')).toBe('0.1234')
    expect(value(typeAll('4', 'it', '0.123'), 'it')).toBeNull()
    // correggendolo diventa leggibile
    expect(value(editAmount('0.123', '0.12', 'it', { kind: 'type', data: null, caret: 4 }), 'it')).toBe(0.12)
  })
})

describe('P1.1: digitazione', () => {
  it.each([
    ['2.35', 'it', 2.35], ['2,35', 'it', 2.35], ['1234,56', 'it', 1234.56], ['1200', 'it', 1200], ['-2,35', 'it', -2.35],
    ['2.35', 'en', 2.35], ['2,35', 'en', 2.35], ['1234.56', 'en', 1234.56],
    ['2.35', 'fr', 2.35], ['2,35', 'fr', 2.35], ['2.35', 'es', 2.35], ['2,35', 'es', 2.35],
    ['0,123', 'it', null], ['0.123', 'en', null],
  ] as const)('tasti %s in %s → %s', (keys, lang, want) => { expect(value(typeAll(keys, lang), lang)).toBe(want) })
  it('stati intermedi: «1.200,» resta così, non è segnato come errore', () => {
    expect(typeAll('1200,', 'it')).toBe('1.200,')
    expect(unreadableAmount('1.200,', 'it')).toBe(false)
    expect(typeAll('1200.', 'en')).toBe('1,200.')
    expect(unreadableAmount('1,200.', 'en')).toBe(false)
  })
  it('selezione e sostituzione: la virgola sostituita da un punto resta il decimale', () => {
    // «2,35» con la virgola selezionata e «.» digitato: il browser lascia «2.35», cursore dopo il punto
    expect(editAmount('2,35', '2.35', 'it', { kind: 'type', data: '.', caret: 2 })).toBe('2,35')
    // «.» digitato con tre cifre dopo, in italiano, raggruppa le migliaia come le legge parseAmount
    expect(editAmount('1200', '1.200', 'it', { kind: 'type', data: '.', caret: 2 })).toBe('1.200')
    // tutto selezionato e sostituito da una cifra
    expect(editAmount('1.234,56', '7', 'it', { kind: 'type', data: '7', caret: 1 })).toBe('7')
  })
  it('il punto digitato in mezzo, in francese, è il decimale', () => {
    expect(value(editAmount('1235', '12.35', 'fr', { kind: 'type', data: '.', caret: 3 }), 'fr')).toBe(12.35)
  })
})
