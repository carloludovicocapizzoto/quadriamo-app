// Statistiche d'uso anonime per la beta: partono SOLO con il consenso dell'utente.
// Si inviano conteggi (quanti movimenti, quanti mesi), mai descrizioni, importi o categorie.
import { scopedClient } from '../sync/scopedClient'
import { currentScope } from '../store/scope'
import { deviceId, isStandalone, platform, statsConsent } from './device'
import { ENV } from '../env'
import { cloudFeature } from '../features'

export type BetaEvent = 'open' | 'install' | 'import' | 'share' | 'feedback' | 'push_on'

export async function track(event: BetaEvent, snapshot: { txCount?: number; monthsUsed?: number; signedIn?: boolean; lang?: string } = {}) {
  const lease = currentScope()
  if (lease.scope.kind === 'demo' || lease.scope.kind === 'recovery') return
  const supabase = scopedClient(lease, true)
  if (!supabase || statsConsent() !== 'yes' || !navigator.onLine || !cloudFeature('telemetry')) return
  try {
    await supabase.from('usage_events').insert({
      device_id: deviceId(), event, lang: snapshot.lang ?? document.documentElement.lang, platform: platform(),
      standalone: isStandalone(), signed_in: snapshot.signedIn ?? null,
      tx_count: snapshot.txCount ?? null, months_used: snapshot.monthsUsed ?? null, app_version: ENV.release,
    })
  } catch { /* le statistiche non devono mai disturbare l'app */ }
}
