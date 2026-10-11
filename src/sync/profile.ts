// Profilo dell'utente registrato (tabella profiles: ognuno legge e scrive solo il proprio).
import { supabase } from './client'

export interface Profile {
  first_name: string | null; last_name: string | null
  monthly_income: number | null; currency: string | null
  goals: string[]; cards: string[]
  invested: 'yes' | 'no' | 'want' | null; invest_where: string[]
  shares: number[] | null                 // percentuali dei quattro portafogli, es. [55, 20, 15, 10]
}

export const GOALS = ['understand', 'save', 'goal', 'debt', 'invest', 'family'] as const
// marchi: restano uguali in tutte le lingue
export const CARDS = ['bank', 'credit', 'prepaid', 'Revolut', 'N26', 'Hype', 'Satispay', 'PayPal', 'American Express', 'cash', 'other'] as const
export const WHERE = ['bank', 'broker', 'etf', 'stocks', 'bonds', 'pension', 'crypto', 'realestate', 'other'] as const

const PROMPT_KEY = 'q.profilePrompt'
/** Dopo la registrazione si propone il profilo una volta (anche se la conferma email arriva dopo). */
export const profilePrompt = {
  set: () => { try { localStorage.setItem(PROMPT_KEY, '1') } catch { /* niente */ } },
  get: () => { try { return localStorage.getItem(PROMPT_KEY) === '1' } catch { return false } },
  clear: () => { try { localStorage.removeItem(PROMPT_KEY) } catch { /* niente */ } },
}

export const emptyProfile = (): Profile => ({ first_name: null, last_name: null, monthly_income: null, currency: null,
  goals: [], cards: [], invested: null, invest_where: [], shares: null })

export async function loadProfile(): Promise<Profile> {
  const { data, error } = await supabase!.from('profiles').select('first_name, last_name, monthly_income, currency, goals, cards, invested, invest_where, shares').maybeSingle()
  if (error) throw error
  if (!data) return emptyProfile()
  return { ...emptyProfile(), ...data, goals: data.goals ?? [], cards: data.cards ?? [], invest_where: data.invest_where ?? [],
    monthly_income: data.monthly_income == null ? null : Number(data.monthly_income), shares: data.shares?.map(Number) ?? null }
}

export async function saveProfile(userId: string, p: Profile) {
  const { error } = await supabase!.from('profiles').upsert({ user_id: userId, ...p,
    invest_where: p.invested === 'yes' ? p.invest_where : [], updated_at: new Date().toISOString() })
  if (error) throw error
}
