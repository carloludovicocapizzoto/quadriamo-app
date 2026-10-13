import { describe, expect, it } from 'vitest'
import type { HubItem } from './hub'
import { learn } from './interests'
import { buildSections, byCategory, rank, stories } from './sections'

const now = Date.parse('2026-10-13T12:00:00Z')
let n = 0
const item = (x: Partial<HubItem> = {}): HubItem => ({
  id: `i${++n}`, title: 'Titolo', excerpt: null, link: `https://x.it/${n}`, thumb: null, published: '2026-10-13T10:00:00Z', lang: 'it',
  format: 'article', categories: ['economy'], level: 'intermediate', minutes: null, relevance: 0.6, cluster: null, crypto: false,
  source: { name: 'Fonte', kind: 'press', paywall: false, trust: 4 }, ...x,
})

describe('Notizie: sezioni', () => {
  it('la stessa notizia da tre fonti è una storia sola, guidata dalla fonte migliore', () => {
    const a = item({ cluster: 'bce', source: { name: 'A', kind: 'press', paywall: false, trust: 3 } })
    const b = item({ cluster: 'bce', source: { name: 'B', kind: 'press', paywall: false, trust: 5 } })
    const c = item({ cluster: 'bce' })
    const s = stories([a, b, c], now, 'it', {})
    expect(s).toHaveLength(1)
    expect(s[0].lead.source.name).toBe('B')
    expect(s[0].others).toHaveLength(2)
  })
  it('sezioni senza ripetizioni e senza cripto', () => {
    const items = [item({ categories: ['budget'] }), item({ format: 'video', categories: ['etf'] }), item({ format: 'research', categories: ['economy'] }),
      item({ crypto: true, categories: ['markets'] })]
    const sec = buildSections(items, now, 'it', {})
    const ids = sec.flatMap(s => s.stories.map(x => x.lead.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain(items[3].id)
    expect(sec.map(s => s.id)).toContain('videos')
    expect(byCategory(items, 'crypto', now, 'it', {}).map(s => s.lead.id)).toEqual([items[3].id])
  })
  it('impara dai gusti: chi apre ETF vede più ETF, e la propria lingua conta', () => {
    const etf = item({ categories: ['etf'] }), eco = item({ categories: ['economy'] })
    const likes = learn(learn({}, etf), etf)
    expect(rank(etf, now, 'it', likes)).toBeGreaterThan(rank(eco, now, 'it', likes))
    expect(rank(item({ lang: 'it' }), now, 'it', {})).toBeGreaterThan(rank(item({ lang: 'en' }), now, 'it', {}))
  })
  it('le notizie invecchiano in fretta, le ricerche no', () => {
    const old = '2026-10-10T12:00:00Z'
    expect(rank(item({ published: old, format: 'research' }), now, 'it', {})).toBeGreaterThan(rank(item({ published: old }), now, 'it', {}))
  })
})
