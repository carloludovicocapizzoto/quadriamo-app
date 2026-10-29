import type { Holding, LiveQuote } from './engine'

// Prezzi automatici delle crypto da CoinGecko (gratuito, senza chiave, leggibile dall'app). Si invia solo l'elenco delle
// monete e delle valute: mai quote né importi. ETF e azioni non hanno una fonte così: restano con il prezzo scritto a mano.
const API = 'https://api.coingecko.com/api/v3/simple/price'

// i ticker più comuni → nome di CoinGecko; per le altre monete si scrive direttamente il nome di CoinGecko (es. «render-token»)
const COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', TRX: 'tron', DOT: 'polkadot', AVAX: 'avalanche-2', LINK: 'chainlink', LTC: 'litecoin',
  BCH: 'bitcoin-cash', XLM: 'stellar', ATOM: 'cosmos', TON: 'the-open-network', SHIB: 'shiba-inu', MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token', NEAR: 'near', UNI: 'uniswap', XMR: 'monero', ETC: 'ethereum-classic', ALGO: 'algorand',
  ARB: 'arbitrum', OP: 'optimism', APT: 'aptos', SUI: 'sui', PEPE: 'pepe', HBAR: 'hedera-hashgraph', FIL: 'filecoin',
  XTZ: 'tezos', AAVE: 'aave', EGLD: 'elrond-erd-2', KAS: 'kaspa', DAI: 'dai', EURC: 'euro-coin',
}

/** Il nome CoinGecko di un titolo crypto, dal ticker; null se non è una crypto o il ticker è vuoto o strano. */
export function coinId(h: Pick<Holding, 'type' | 'ticker'>): string | null {
  const t = (h.ticker ?? '').trim()
  if (h.type !== 'crypto' || !t) return null
  return COINS[t.toUpperCase()] ?? (/^[a-z0-9-]{2,60}$/.test(t) ? t : null)
}

/** Che cosa chiedere per un portafoglio: monete e valute, in ordine (così la stessa richiesta dà la stessa chiave). */
export function quoteRequest(holdings: Holding[], currency: string) {
  const want = holdings.map(h => ({ id: h.id, coin: coinId(h), vs: (h.currency || currency).toLowerCase() })).filter(x => x.coin)
  return { want: want as { id: string; coin: string; vs: string }[], coins: [...new Set(want.map(x => x.coin!))].sort(),
           vs: [...new Set(want.map(x => x.vs))].sort() }
}

/** Prezzi e variazioni delle 24 ore, per moneta e valuta («bitcoin:eur»). Le monete che CoinGecko non conosce mancano. */
export async function fetchCryptoQuotes(holdings: Holding[], currency: string, now = new Date()): Promise<Record<string, LiveQuote>> {
  const q = quoteRequest(holdings, currency)
  if (!q.coins.length) return {}
  const res = await fetch(`${API}?ids=${q.coins.join(',')}&vs_currencies=${q.vs.join(',')}&include_24hr_change=true`)
  if (!res.ok) throw new Error(`quotes ${res.status}`)
  return parseQuotes(await res.json() as unknown, q.coins, q.vs, now.toISOString())
}

export function parseQuotes(json: unknown, coins: string[], vs: string[], at: string): Record<string, LiveQuote> {
  const out: Record<string, LiveQuote> = {}
  if (!json || typeof json !== 'object') return out
  for (const coin of coins) for (const v of vs) {
    const row = (json as Record<string, Record<string, unknown> | undefined>)[coin]
    const price = row?.[v], change = row?.[`${v}_24h_change`]
    if (typeof price !== 'number' || !(price > 0)) continue
    out[`${coin}:${v}`] = { price, change: typeof change === 'number' && Number.isFinite(change) ? change / 100 : null, at }
  }
  return out
}

/** I prezzi della memoria, titolo per titolo (stessa moneta e valuta, stesso prezzo). */
export function quotesFor(holdings: Holding[], currency: string, live: Record<string, LiveQuote>): Record<string, LiveQuote> {
  const out: Record<string, LiveQuote> = {}
  for (const w of quoteRequest(holdings, currency).want) { const x = live[`${w.coin}:${w.vs}`]; if (x) out[w.id] = x }
  return out
}
