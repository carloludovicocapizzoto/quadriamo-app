import { supabase } from '../sync/client'
import { APP_VERSION, deviceId, markFeedbackAsked } from './device'
import { track } from './telemetry'

/** Invia un feedback (voto 1-5 e/o testo). Funziona anche senza account. */
export async function sendFeedback(rating: number | null, message: string, lang: string): Promise<void> {
  if (!supabase) throw new Error('offline')
  const { error } = await supabase.from('feedback').insert({
    device_id: deviceId(), rating, message: message.trim() || null, lang, app_version: APP_VERSION,
  })
  if (error) throw error
  markFeedbackAsked()
  void track('feedback')
}
