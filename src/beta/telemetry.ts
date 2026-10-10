// Statistiche d'uso anonime per la beta: partono SOLO con il consenso dell'utente.
// Si inviano conteggi (quanti movimenti, quanti mesi), mai descrizioni, importi o categorie.
import { supabase } from '../sync/client'
import { APP_VERSION, deviceId, isStandalone, platform, statsConsent } from './device'

export type BetaEvent = 'open' | 'install' | 'import' | 'share' | 'feedback' | 'push_on'

export async function track(event: BetaEvent, snapshot: { txCount?: number; monthsUsed?: number; signedIn?: boolean; lang?: string } = {}) {
  if (!supabase || statsConsent() !== 'yes' || !navigator.onLine) return
  try {
    await supabase.from('usage_events').insert({
      device_id: deviceId(), event, lang: snapshot.lang ?? document.documentElement.lang, platform: platform(),
      standalone: isStandalone(), signed_in: snapshot.signedIn ?? null,
      tx_count: snapshot.txCount ?? null, months_used: snapshot.monthsUsed ?? null, app_version: APP_VERSION,
    })
  } catch { /* le statistiche non devono mai disturbare l'app */ }
}
