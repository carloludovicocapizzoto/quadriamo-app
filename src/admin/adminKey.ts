// Accesso all'area amministratore con nome + codice (senza account): il codice resta su questo dispositivo e viaggia
// nell'intestazione "x-admin-key"; il database ne conosce solo l'impronta SHA-256 (supabase/migrations/0006_admin_key.sql).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../sync/client'

const KEY = 'q.adminKey'
export interface AdminKey { name: string; code: string }

export function savedKey(): AdminKey | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v?.name && v?.code ? v : null } catch { return null }
}
export function saveKey(k: AdminKey | null) {
  try { if (k) localStorage.setItem(KEY, JSON.stringify(k)); else localStorage.removeItem(KEY) } catch { /* niente */ }
}

/** Codice casuale di 24 caratteri (senza lettere che si confondono). */
export function newCode(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint32Array(24))
  return Array.from(r, n => abc[n % abc.length]).join('').replace(/(.{6})(?!$)/g, '$1-')
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

let keyed: SupabaseClient | null = null
let keyedCode = ''
/** Il client da usare: con il codice (se c'è) oppure quello normale con l'accesso via email. */
export function db(): SupabaseClient | null {
  const k = savedKey()
  if (!k || !supabase) return supabase
  if (!keyed || keyedCode !== k.code) {
    keyedCode = k.code
    keyed = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'q-admin-key' },
      global: { headers: { 'x-admin-key': k.code } },
    })
  }
  return keyed
}
export const keyHeaders = (): Record<string, string> => { const k = savedKey(); return k ? { 'x-admin-key': k.code } : {} }
