// Client Supabase: attivo solo se l'ambiente ha URL e chiave pubblica (src/env.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authStorage, authStorageKey } from './authStorage'
import { ENV } from '../env'

export const supabase: SupabaseClient | null = ENV.supabase
  ? createClient(ENV.supabase.url, ENV.supabase.key, { auth: { storage: authStorage(authStorageKey(ENV.supabase.url)), persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
