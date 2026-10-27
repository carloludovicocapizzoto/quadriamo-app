import { scopedClient } from '../sync/scopedClient'
import { currentScope } from '../store/scope'
import { deviceId, markFeedbackAsked } from './device'
import { track } from './telemetry'
import { ENV } from '../env'

export type Alternative = 'nothing' | 'spreadsheet' | 'notes' | 'bank_app' | 'other_app'

/** Invia un feedback (voto 1-5, testo, e la risposta a "Se non ci fosse Quadriamo, cosa useresti?"). */
export async function sendFeedback(rating: number | null, message: string, lang: string,
  alternative: Alternative | null = null, alternativeOther = ''): Promise<void> {
  const lease = currentScope(), supabase = scopedClient(lease, true)
  if (!supabase) throw new Error('offline')
  const { error } = await supabase.from('feedback').insert({
    device_id: deviceId(), rating, message: message.trim() || null, lang, app_version: ENV.release,
    ...(alternative ? { alternative, alternative_other: alternative === 'other_app' ? alternativeOther.trim().slice(0, 120) || null : null } : {}),
  })
  lease.assert()
  if (error) throw error
  markFeedbackAsked()
  void track('feedback')
}
