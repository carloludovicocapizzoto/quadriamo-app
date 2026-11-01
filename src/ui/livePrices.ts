import { useEffect, useRef, useState } from 'react'
import { recordPrice, type Investments, type LiveQuote, type PriceDays, type Settings } from '../engine'
import { fetchCryptoQuotes, quoteRequest, quotesFor } from '../quotes'
import { useStore } from '../store/context'
import { personal } from '../storage'
import { currentScope, type ScopeLease } from '../store/scope'

// I prezzi restano su questo dispositivo, fuori dai dati sincronizzati: gli investimenti si uniscono tra dispositivi
// in blocco, e un aggiornamento automatico dei prezzi potrebbe cancellare le quote appena cambiate su un altro telefono.
const KEY = 'quadriamo.prices'
const EVERY = 10 * 60_000   // CoinGecko senza chiave ha limiti bassi: una richiesta ogni 10 minuti al massimo

// live: per moneta e valuta («bitcoin:eur»); days: per titolo
export interface StoredPrices { live: Record<string, LiveQuote>; days: Record<string, PriceDays>; checked?: string; key?: string }
export const readPrices = (): StoredPrices => {
  const raw = personal.json<Partial<StoredPrices>>(KEY, {})
  const live = Object.fromEntries(Object.entries(raw?.live ?? {}).filter(([,q])=>q && Number.isFinite(q.price) && q.price > 0 && Number.isFinite(Date.parse(q.at)) && Date.now()-Date.parse(q.at) >= 0 && Date.now()-Date.parse(q.at) < 86400000))
  const days = Object.fromEntries(Object.entries(raw?.days ?? {}).filter(([,d])=>Array.isArray(d)).map(([id,d])=>[id,d.filter(x=>x && Number.isFinite(x.price) && x.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).slice(-2)]))
  return { ...raw, live, days }
}
export function saveFetchedPrices(lease: ScopeLease, key: string, live: Record<string, LiveQuote>) {
  if (!lease.current()) return null
  const now = readPrices()
  const next = { ...now, live: { ...now.live, ...live }, checked: new Date().toISOString(), key }
  personal.setJson(KEY, next)
  return next
}

/** Ricorda i prezzi scritti a mano (per la variazione) e lascia fuori dalla memoria i titoli che non ci sono più. */
export function rememberManual(p: StoredPrices, inv: Investments, today: string): StoredPrices {
  const days: Record<string, PriceDays> = {}
  for (const h of inv.holdings) {
    const d = p.days[h.id] ?? []
    if (h.manualPrice != null && Number.isFinite(h.manualPrice) && h.manualPrice > 0) days[h.id] = recordPrice(d, today, h.manualPrice)
    else if (d.length) days[h.id] = d
  }
  return { ...p, days }
}

/** Prezzi automatici delle crypto e variazioni dei prezzi a mano, finché la schermata è aperta. */
export function useLivePrices(inv: Investments, settings: Settings, today: string) {
  const { lease: owner } = useStore()
  const ownerLease = owner ?? currentScope()
  const scopeId = ownerLease.id
  const [snapshot, setSnapshot] = useState(() => ({ scopeId, prices: readPrices() }))
  const stored = snapshot.scopeId === scopeId ? snapshot.prices : readPrices()
  // i prezzi a mano di oggi si calcolano qui e si salvano dopo: il disegno non aspetta la memoria del browser
  const days = rememberManual(stored, inv, today).days

  useEffect(() => {
    if (!ownerLease.current()) return
    const now = readPrices()
    if (JSON.stringify(now.days) !== JSON.stringify(days)) personal.setJson(KEY, { ...now, days })
  }, [days, ownerLease])

  const holdings = useRef(inv.holdings)
  useEffect(() => { holdings.current = inv.holdings })
  const q = quoteRequest(inv.holdings, settings.currency)
  const key = q.coins.length ? `${q.coins.join(',')}|${q.vs.join(',')}` : ''
  useEffect(() => {
    if (!key) return
    const lease = ownerLease
    let alive = true
    let pending = false
    let attempted = 0
    const check = () => {
      const p = readPrices()
      if (alive && lease.current()) setSnapshot({ scopeId, prices: p })
      if (!alive || !lease.current() || pending || Date.now() - attempted < EVERY || !navigator.onLine || (p.key === key && p.checked && Date.now() - Date.parse(p.checked) < EVERY)) return
      pending = true
      attempted = Date.now()
      fetchCryptoQuotes(holdings.current, settings.currency).then(live => {
        if (!alive || !lease.current()) return
        const next = saveFetchedPrices(lease, key, live)
        if (next) setSnapshot({ scopeId, prices: next })
      }).catch(() => { /* offline o limite raggiunto: restano gli ultimi prezzi, con la loro ora */ }).finally(() => { pending = false })
    }
    check()
    const id = setInterval(check, EVERY)
    return () => { alive = false; clearInterval(id) }
    // la richiesta dipende solo da monete e valute (key), non da ogni modifica dei titoli
  }, [key, settings.currency, scopeId, ownerLease])

  if (!ownerLease.current()) return { live: {}, days: {}, byHolding: {} }
  return { live: stored.live, days, byHolding: quotesFor(inv.holdings, settings.currency, stored.live) }
}
