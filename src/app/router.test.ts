import { describe, expect, it } from 'vitest'
import { format, parse, type Route } from './router'

describe('router', () => {
  it('andata e ritorno tra indirizzo e pagina', () => {
    const routes: Route[] = [{ tab: 'home' }, { tab: 'news' }, { tab: 'profile' }, { tab: 'profile', page: 'plan' },
      { tab: 'analysis', view: 'transactions' }, { tab: 'analysis', view: 'month', month: '2026-09' }, { tab: 'analysis', view: 'year', year: 2025 }]
    for (const r of routes) expect(parse(format(r))).toEqual(r)
  })
  it('indirizzi sconosciuti o rovinati portano a una pagina valida', () => {
    expect(parse('')).toEqual({ tab: 'home' })
    expect(parse('#/boh')).toEqual({ tab: 'home' })
    expect(parse('#/analysis/xyz?m=99')).toEqual({ tab: 'analysis', view: 'month' })
    expect(parse('#/profile/hack')).toEqual({ tab: 'profile' })
  })
})
