// Free e Pro. Durante la beta Pro è gratis per tutti (BETA_ALL_PRO): il pagamento si può già provare in modalità test.
// Cosa è Pro e i prezzi mostrati si cambiano qui; il prezzo vero lo decide Stripe (prezzi in STRIPE_PRICE_MONTHLY/YEARLY).
import { useEffect, useState } from 'react'
import { supabase } from '../sync/client'
import { useSync } from '../sync/context'

export const BETA_ALL_PRO = true
export const PRICE = { month: 2.99, year: 24.99, currency: 'EUR' }
export type ProFeature = 'reports' | 'investments' | 'shared'

export interface Subscription { status: string; interval: 'month' | 'year' | null; current_period_end: string | null; cancel_at_period_end: boolean; livemode: boolean }
export interface Plan { pro: boolean; beta: boolean; sub: Subscription | null; loading: boolean }

const PREVIEW = 'q.planPreview'   // "free": mostra l'app come la vedrebbe chi non ha Pro (per provare la schermata di Pro)
export const previewFree = () => { try { return localStorage.getItem(PREVIEW) === 'free' } catch { return false } }
export const setPreviewFree = (on: boolean) => { try { if (on) localStorage.setItem(PREVIEW, 'free'); else localStorage.removeItem(PREVIEW) } catch { /* niente */ } }

const isActive = (s: Subscription | null) => !!s && ['active', 'trialing', 'past_due'].includes(s.status)
const listeners = new Set<() => void>()
/** Dopo un pagamento o un cambio: rilegge il piano in tutte le schermate. */
export const refreshPlan = () => listeners.forEach(f => f())

export function usePlan(): Plan {
  const sync = useSync()
  const [tick, setTick] = useState(0)
  const [res, setRes] = useState<{ user: string; sub: Subscription | null } | null>(null)
  useEffect(() => { const f = () => setTick(x => x + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  const user = sync.user?.id ?? null
  useEffect(() => {
    if (!supabase || !user) return
    let alive = true
    void supabase.from('subscriptions').select('status, interval, current_period_end, cancel_at_period_end, livemode').maybeSingle()
      .then(({ data }) => { if (alive) setRes({ user, sub: (data as Subscription | null) ?? null }) })
    return () => { alive = false }
  }, [user, tick])
  const sub = user && res?.user === user ? res.sub : null
  const paid = isActive(sub)
  const beta = BETA_ALL_PRO && !previewFree()
  return { pro: paid || beta, beta: beta && !paid, sub, loading: !!supabase && !!user && res?.user !== user }
}

/** Chiede di aprire la scheda del piano (Opzioni): la ascolta App. */
export const askUpgrade = () => window.dispatchEvent(new Event('quadriamo:upgrade'))

async function billing(body: Record<string, unknown>): Promise<{ url?: string; error?: string; configured?: boolean; test?: boolean }> {
  if (!supabase) throw new Error('offline')
  const { data, error } = await supabase.functions.invoke('billing', { body })
  if (error) {
    // il messaggio vero è nel corpo della risposta
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then(j => j.error).catch(() => null) : null
    throw new Error(msg ?? error.message)
  }
  return data
}

/** Apre la pagina di pagamento di Stripe (l'app riprende con ?pro=ok o ?pro=cancel). */
export async function startCheckout(interval: 'month' | 'year') {
  const { url } = await billing({ action: 'checkout', interval })
  if (url) window.location.assign(url)
}
/** Pagina Stripe per cambiare carta, piano o disdire. */
export async function openPortal() {
  const { url } = await billing({ action: 'portal' })
  if (url) window.location.assign(url)
}
export async function billingStatus() {
  try { return await billing({ action: 'status' }) } catch { return { configured: false } }
}
