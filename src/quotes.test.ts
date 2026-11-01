import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Holding } from './engine'
import { coinId, fetchCryptoQuotes, parseQuotes, quoteRequest, quotesFor } from './quotes'

const h = (id: string, ticker: string, type = 'crypto', currency: string | null = null): Holding =>
  ({ id, name: id, type, ticker, currency, units: 1, avgPrice: 1 })

describe('monete', () => {
  it('ticker comuni, nomi CoinGecko e titoli che non sono crypto', () => {
    expect(coinId(h('a', 'btc'))).toBe('bitcoin')
    expect(coinId(h('a', ' ETH '))).toBe('ethereum')
    expect(coinId(h('a', 'render-token'))).toBe('render-token')
    expect(coinId(h('a', 'VWCE', 'etf'))).toBeNull()
    expect(coinId(h('a', ''))).toBeNull()
    expect(coinId(h('a', 'a/b?c'))).toBeNull()
    expect(coinId(h('a', 'FOO'))).toBeNull()
  })
  it('una richiesta sola, con monete e valute senza doppioni', () => {
    const q = quoteRequest([h('a', 'BTC'), h('b', 'bitcoin', 'crypto', 'USD'), h('c', 'VWCE', 'etf')], 'EUR')
    expect(q.coins).toEqual(['bitcoin']); expect(q.vs).toEqual(['eur', 'usd']); expect(q.want.map(w => w.id)).toEqual(['a', 'b'])
  })
})

describe('risposta di CoinGecko', () => {
  const coins = ['bitcoin', 'ethereum', 'nope']
  it('prezzi e variazioni in frazione; i dati strani si scartano', () => {
    const out = parseQuotes({ bitcoin: { eur: 60000, eur_24h_change: 2.5 }, ethereum: { eur: 'x' } }, coins, ['eur'], 'T')
    expect(out).toEqual({ 'bitcoin:eur': { price: 60000, change: 0.025, at: 'T' } })
    expect(parseQuotes(null, coins, ['eur'], 'T')).toEqual({})
    expect(parseQuotes({ bitcoin: { eur: 1, eur_24h_change: null } }, coins, ['eur'], 'T')['bitcoin:eur'].change).toBeNull()
  })
  it('lo stesso prezzo a tutti i titoli della stessa moneta e valuta', () => {
    const live = { 'bitcoin:eur': { price: 1, change: null, at: 'T' } }
    expect(Object.keys(quotesFor([h('a', 'BTC'), h('b', 'bitcoin'), h('c', 'BTC', 'crypto', 'USD')], 'EUR', live))).toEqual(['a', 'b'])
  })
})

describe('richiesta', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('manda solo monete e valute, mai le quote', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ bitcoin: { eur: 50000, eur_24h_change: -1 } })))
    vi.stubGlobal('fetch', fetch)
    const out = await fetchCryptoQuotes([{ ...h('a', 'BTC'), units: 0.123 }], 'EUR', new Date('2026-10-29T10:00:00Z'))
    expect(out['bitcoin:eur']).toEqual({ price: 50000, change: -0.01, at: '2026-10-29T10:00:00.000Z' })
    const url = String((fetch.mock.calls[0] as unknown[])[0])
    expect(url).toBe('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur&include_24hr_change=true')
    expect(url).not.toContain('0.123')
  })
  it('senza crypto non chiama nessuno; un errore del servizio si propaga', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 429 }))
    vi.stubGlobal('fetch', fetch)
    expect(await fetchCryptoQuotes([h('c', 'VWCE', 'etf')], 'EUR')).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
    await expect(fetchCryptoQuotes([h('a', 'BTC')], 'EUR')).rejects.toThrow('quotes 429')
  })
})
