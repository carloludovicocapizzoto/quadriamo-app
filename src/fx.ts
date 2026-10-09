import type { AppData } from './store/state'

// Cambi automatici dalla Banca Centrale Europea tramite Frankfurter (gratuito, senza chiave, aggiornato nei giorni lavorativi).
// Si invia solo l'elenco delle valute: nessun dato personale.
export const FX_SUPPORTED = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR',
  'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR']

/** Restituisce, per ogni valuta, quante unità della tua valuta vale 1 unità di quella valuta. */
export async function fetchRates(base: string, currencies: string[]): Promise<{ rates: Record<string, number>; date: string }> {
  const wanted = currencies.filter(c => c !== base && FX_SUPPORTED.includes(c))
  if (!wanted.length || !FX_SUPPORTED.includes(base)) return { rates: {}, date: '' }
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${wanted.join(',')}`)
  if (!res.ok) throw new Error(`fx ${res.status}`)
  const j = await res.json() as { date: string; rates: Record<string, number> }
  const rates: Record<string, number> = {}
  for (const [c, r] of Object.entries(j.rates)) if (r > 0) rates[c] = Math.round((1 / r) * 1e6) / 1e6
  return { rates, date: j.date }
}

const DEFAULT_FOREIGN = ['USD', 'GBP', 'CHF']

/** Valute per cui serve un cambio: quelle usate nei movimenti e nel portafoglio, più quelle già in elenco. */
export function neededCurrencies(d: AppData): string[] {
  const set = new Set<string>([...DEFAULT_FOREIGN, ...Object.keys(d.settings.fxRates)])
  for (const t of d.transactions) if (t.currency) set.add(t.currency)
  for (const h of d.investments?.holdings ?? []) if (h.currency) set.add(h.currency)
  set.delete(d.settings.currency)
  return [...set].sort()
}

