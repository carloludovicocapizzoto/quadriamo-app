import { describe, expect, it } from 'vitest'
import { inputModeFrom } from './inputMode'

const key = (k: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey', boolean>> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods })

describe('tastiera o tocco (P2-004)', () => {
  it('Tab, Invio, Spazio, Esc e frecce: tastiera', () => {
    for (const k of ['Tab', 'Enter', ' ', 'Escape', 'ArrowDown']) expect(inputModeFrom(key(k))).toBe('keyboard')
  })
  it('dito, penna e mouse: puntatore', () => {
    for (const pointerType of ['touch', 'pen', 'mouse']) expect(inputModeFrom({ pointerType })).toBe('pointer')
  })
  it('modificatori da soli e scorciatoie non cambiano il modo', () => {
    expect(inputModeFrom(key('Shift'))).toBeNull()
    expect(inputModeFrom(key('c', { metaKey: true }))).toBeNull()
    expect(inputModeFrom(key('v', { ctrlKey: true }))).toBeNull()
  })
})
