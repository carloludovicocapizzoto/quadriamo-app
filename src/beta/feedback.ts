import { supabase } from '../sync/client'
import { APP_VERSION, deviceId, markFeedbackAsked } from './device'
import { track } from './telemetry'

export type Alternative = 'nothing' | 'spreadsheet' | 'notes' | 'bank_app' | 'other_app'

/** Invia un feedback (voto 1-5, testo, e la risposta a "Se non ci fosse Quadriamo, cosa useresti?"). */
export async function sendFeedback(rating: number | null, message: string, lang: string,
  alternative: Alternative | null = null, alternativeOther = ''): Promise<void> {
  if (!supabase) throw new Error('offline')
  const { error } = await supabase.from('feedback').insert({
    device_id: deviceId(), rating, message: message.trim() || null, lang, app_version: APP_VERSION,
    ...(alternative ? { alternative, alternative_other: alternative === 'other_app' ? alternativeOther.trim().slice(0, 120) || null : null } : {}),
  })
  if (error) throw error
  markFeedbackAsked()
  void track('feedback')
}
