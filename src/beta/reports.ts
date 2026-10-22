// Segnalazioni di chi prova la beta (tabella tester_reports e archivio privato "reports", migrazione 0026):
// bug o idea, priorità, descrizione, allegati e diagnostica automatica (dispositivo, sistema, versione, lingua,
// ora, ultimi passi del diario tecnico). Gli allegati solo con l'accesso: vanno nella cartella dell'utente.
import { deviceInfo, route, trailNow } from '../app/diagnostics'
import { ENV } from '../env'
import { shrinkImage } from '../image'
import { scopedClient } from '../sync/scopedClient'
import { currentScope } from '../store/scope'
import { deviceId, uuid } from './device'

export type ReportKind = 'bug' | 'idea'
export type Priority = 'low' | 'normal' | 'high' | 'blocking'
export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'blocking']
export const MAX_IMAGES = 3
export const MAX_VIDEOS = 1
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024

export interface ReportDraft { kind: ReportKind; priority: Priority; message: string; files: File[]; withDiagnostics: boolean }

/** Quello che parte con "Allega la diagnostica": l'utente può vederlo prima di inviare. */
export const diagnostics = () => ({
  ...deviceInfo(), at: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  route: route(), trail: trailNow(),
})

const isVideo = (f: File) => f.type.startsWith('video/')
/** Gli allegati accettati: immagini e video, entro i limiti; il resto torna indietro con il motivo. */
export function acceptFiles(current: File[], added: File[]): { files: File[]; rejected: { name: string; why: 'type' | 'size' | 'count' }[] } {
  const files = [...current], rejected: { name: string; why: 'type' | 'size' | 'count' }[] = []
  for (const f of added) {
    const video = isVideo(f)
    if (!video && !f.type.startsWith('image/')) rejected.push({ name: f.name, why: 'type' })
    else if (video && f.size > MAX_VIDEO_BYTES) rejected.push({ name: f.name, why: 'size' })
    else if (files.filter(x => isVideo(x) === video).length >= (video ? MAX_VIDEOS : MAX_IMAGES)) rejected.push({ name: f.name, why: 'count' })
    else files.push(f)
  }
  return { files, rejected }
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }

export async function sendReport(d: ReportDraft, userId: string | null): Promise<void> {
  const lease = currentScope(), supabase = scopedClient(lease, true)
  if (!supabase) throw new Error('offline')
  if (userId && (lease.scope.kind !== 'account' || lease.scope.owner !== userId)) throw Error('report owner mismatch')
  const id = uuid()
  const attachments: string[] = []
  if (userId) for (const [i, f] of d.files.entries()) {
    // le foto si riducono (lato lungo 1600 px); se il browser non sa leggerle (HEIC su Chrome) partono come sono
    const blob = isVideo(f) ? f : await shrinkImage(f, { size: 1600 }).catch(() => f)
    lease.assert()
    const path = `${userId}/${id}/${i + 1}.${EXT[blob.type] ?? 'bin'}`
    const { error } = await supabase.storage.from('reports').upload(path, blob, { contentType: blob.type })
    lease.assert()
    if (error) throw error
    attachments.push(path)
  }
  const { error } = await supabase.from('tester_reports').insert({
    id, kind: d.kind, priority: d.priority, message: d.message.trim(), attachments, device_id: deviceId(),
    diagnostics: d.withDiagnostics ? diagnostics() : null, env: ENV.name, version: ENV.release,
  })
  lease.assert()
  if (error) throw error
}
