import { describe, expect, it } from 'vitest'
import { note, trailNow } from './diagnostics'
import { activateScope } from '../store/scope'

describe('diario tecnico', () => {
  it('tiene solo gli ultimi 40 passi, i più vecchi escono', () => {
    for (let i = 0; i < 50; i++) note('action', `a${i}`)
    const t = trailNow()
    expect(t).toHaveLength(40)
    expect(t[0].what).toBe('a10')
    expect(t.at(-1)?.what).toBe('a49')
  })
  it('taglia i testi lunghi', () => {
    note('nav', 'x'.repeat(500))
    expect(trailNow().at(-1)?.what).toHaveLength(120)
  })
  it('does not attach the previous account trail to a new account report', () => {
    activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'A' })
    note('action', 'A-only')
    activateScope({ environment: 'test', backend: 'synthetic', kind: 'account', owner: 'B' })
    expect(trailNow()).toEqual([])
  })
})
