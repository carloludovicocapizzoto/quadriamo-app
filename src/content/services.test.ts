import { describe, expect, it } from 'vitest'
import { SERVICES, searchServices } from './services'

describe('catalogo degli abbonamenti', () => {
  it('id unici e colori validi', () => {
    expect(new Set(SERVICES.map(s => s.id)).size).toBe(SERVICES.length)
    expect(SERVICES.every(s => /^#[0-9A-F]{6}$/i.test(s.color))).toBe(true)
  })
  it('ricerca: prima chi inizia così, poi chi lo contiene; senza accenti né maiuscole', () => {
    expect(searchServices('net')[0].name).toBe('Netflix')
    expect(searchServices('music').map(s => s.id)).toEqual(expect.arrayContaining(['apple-music', 'amazon-music']))
    expect(searchServices('DISNEY')[0].id).toBe('disney-plus')
    expect(searchServices('sole')[0].id).toBe('sole24ore')
    expect(searchServices('google ai plus')[0].id).toBe('google-gemini')
    expect(searchServices('GEMINI')[0].id).toBe('google-gemini')
    expect(searchServices('apple care plus')[0].id).toBe('applecare-plus')
    expect(searchServices('Github Copilot')[0].id).toBe('github-copilot')
    expect(searchServices('zzzz')).toEqual([])
  })
  it('senza testo: i più usati, o tutta la categoria', () => {
    expect(searchServices('').every(s => s.popular)).toBe(true)
    expect(searchServices('', 'gaming').every(s => s.category === 'gaming')).toBe(true)
  })
})
