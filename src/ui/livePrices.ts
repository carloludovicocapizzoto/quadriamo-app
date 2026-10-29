import { useEffect, useRef, useState } from 'react'
import { recordPrice, type Investments, type LiveQuote, type PriceDays, type Settings } from '../engine'
import { fetchCryptoQuotes, quoteRequest, quotesFor } from '../quotes'
import { personal } from '../storage'

// I prezzi restano su questo dispositivo, fuori dai dati sincronizzati: gli investimenti si uniscono tra dispositivi
// in blocco, e un aggiornamento automatico dei prezzi potrebbe cancellare le quote appena cambiate su un altro telefono.
const KEY = 'quadriamo.prices'
const EVERY = 10 * 60_000   // CoinGecko senza chiave ha limiti bassi: una richiesta ogni 10 minuti al massimo

// live: per moneta e valuta («bitcoin:eur»); days: per titolo
export interface StoredPrices { live: Record<string, LiveQuote>; days: Record<string, PriceDays>; checked?: string; key?: string }
export const readPrices = (): StoredPrices => ({ live: {}, days: {}, ...personal.json<Partial<StoredPrices>>(KEY, {}) })

/** Ricorda i prezzi scritti a mano (per la variazione) e lascia fuori dalla memoria i titoli che non ci sono più. */
export function rememberManual(p: StoredPrices, inv: Investments, today: string): StoredPrices {
  const days: Record<string, PriceDays> = {}
  for (const h of inv.holdings) {
    const d = p.days[h.id] ?? []
    if (h.manualPrice != null && h.manualPrice > 0) days[h.id] = recordPrice(d, today, h.manualPrice)
    else if (d.length) days[h.id] = d
  }
  return { ...p, days }
}

/** Prezzi automatici delle crypto e variazioni dei prezzi a mano, finché la schermata è aperta. */
export function useLivePrices(inv: Investments, settings: Settings, today: string) {
  const [stored, setStored] = useState(readPrices)
  // i prezzi a mano di oggi si calcolano qui e si salvano dopo: il disegno non aspetta la memoria del browser
  const days = rememberManual(stored, inv, today).days

  useEffect(() => {
    const now = readPrices()
    if (JSON.stringify(now.days) !== JSON.stringify(days)) personal.setJson(KEY, { ...now, days })
  }, [days])

  const holdings = useRef(inv.holdings)
  useEffect(() => { holdings.current = inv.holdings })
  const q = quoteRequest(inv.holdings, settings.currency)
  const key = q.coins.length ? `${q.coins.join(',')}|${q.vs.join(',')}` : ''
  useEffect(() => {
    if (!key) return
    let alive = true
    const check = () => {
      const p = readPrices()
      if (!navigator.onLine || (p.key === key && p.checked && Date.now() - Date.parse(p.checked) < EVERY)) return
      fetchCryptoQuotes(holdings.current, settings.currency).then(live => {
        const now = readPrices()
        const next = { ...now, live: { ...now.live, ...live }, checked: new Date().toISOString(), key }
        personal.setJson(KEY, next)
        if (alive) setStored(next)
      }).catch(() => { /* offline o limite raggiunto: restano gli ultimi prezzi, con la loro ora */ })
    }
    check()
    const id = setInterval(check, EVERY)
    return () => { alive = false; clearInterval(id) }
    // la richiesta dipende solo da monete e valute (key), non da ogni modifica dei titoli
  }, [key, settings.currency])

  return { live: stored.live, days, byHolding: quotesFor(inv.holdings, settings.currency, stored.live) }
}
