import { describe, expect, it } from 'vitest'
import en from './en'
import es from './es'
import fr from './fr'
import itDict from './it'
import { detectLang } from './core'

describe('i18n', () => {
  it('every language has every key, none empty', () => {
    for (const d of [itDict, fr, es]) {
      expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort())
      expect(Object.values(d).every(v => v.trim().length > 0)).toBe(true)
    }
  })
  it('picks the browser language, falls back to English', () => {
    expect(detectLang(['it-IT', 'en'])).toBe('it')
    expect(detectLang(['fr-CA'])).toBe('fr')
    expect(detectLang(['de-DE', 'es-ES'])).toBe('es')
    expect(detectLang(['de-DE'])).toBe('en')
  })
})
