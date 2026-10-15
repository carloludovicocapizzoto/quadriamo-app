// Ricerca anonima (facoltativa): una scheda senza account, nome né email, con le entrate solo per fascia.
// È legata a un codice casuale di questo dispositivo, che serve solo per aggiornarla o ritirarla.
import type { PrivateProfile } from '../store/state'
import { supabase } from './client'

const KEY = 'q.researchToken'
function token(create: boolean): string | null {
  try {
    let t = localStorage.getItem(KEY)
    if (!t && create) { t = crypto.randomUUID(); localStorage.setItem(KEY, t) }
    return t
  } catch { return null }
}

function incomeBand(n: number | null): string | null {
  if (n == null) return null
  return n < 1000 ? 'lt1000' : n < 1500 ? '1000-1500' : n < 2000 ? '1500-2000' : n < 3000 ? '2000-3000' : 'ge3000'
}

/** Invia o aggiorna la scheda anonima; con research=false la ritira. */
export async function syncResearch(p: PrivateProfile | null, shares: number[]) {
  if (!supabase) return
  if (!p?.research) {
    const t = token(false)
    if (t) { await supabase.rpc('remove_research', { p_token: t }); try { localStorage.removeItem(KEY) } catch { /* niente */ } }
    return
  }
  const t = token(true)
  if (!t) return
  const { error } = await supabase.rpc('submit_research', { p_token: t, p_income_band: incomeBand(p.monthlyIncome), p_goals: p.goals,
    p_cards: p.cards, p_invested: p.invested, p_where: p.invested === 'yes' ? p.investWhere : [], p_shares: shares.map(x => Math.round(x)) })
  if (error) throw error
}
