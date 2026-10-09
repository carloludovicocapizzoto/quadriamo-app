import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData } from '../store/state'

export async function fetchRemote(sb: SupabaseClient, userId: string): Promise<AppData | null> {
  const { data, error } = await sb.from('user_data').select('data').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data?.data as AppData | undefined) ?? null
}

export async function pushRemote(sb: SupabaseClient, userId: string, d: AppData): Promise<void> {
  const { error } = await sb.from('user_data')
    .upsert({ user_id: userId, data: d, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}
