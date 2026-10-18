import { ENV } from '../env'
import { supabase } from './client'
import type { DataScope } from '../store/scope'

export function scopeFor(owner: string | null, kind?: DataScope['kind']): DataScope {
  return { environment: ENV.name, backend: ENV.supabase?.url.replace(/\/$/, '') ?? window.location.origin + ENV.base,
    kind: kind ?? (owner ? 'account' : supabase ? 'guest' : 'local'), owner }
}
