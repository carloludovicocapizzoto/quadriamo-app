import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingWrite, RemoteDocument } from './protocol'
import { supportedData } from '../store/persist'

export interface WriteReceipt { status: 'applied' | 'conflict'; revision: string; operation: string; replay: boolean }
export class ProtocolError extends Error {
  readonly code: string
  readonly status: number
  constructor(message: string, code: string, status = 0) { super(message); this.code = code; this.status = status }
}
async function deadline<T>(request: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([Promise.resolve(request(controller.signal)), new Promise<T>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new DOMException('synchronization timed out', 'TimeoutError')) }, 15_000)
    })])
  } finally { clearTimeout(timer) }
}
export async function readRemote(sb: SupabaseClient, activate = false): Promise<RemoteDocument> {
  const { data, error, status } = await deadline(signal => sb.rpc(activate ? 'qsync_activate' : 'qsync_read').abortSignal(signal))
  if (error) throw new ProtocolError(error.message, error.code, status)
  if (!data || data.protocol !== 1 || typeof data.revision !== 'string' || !/^(0|[1-9]\d*)$/.test(data.revision)
    || !['legacy', 'protected', 'paused'].includes(data.mode) || data.document !== null && (!supportedData(data.document) || data.document.demo)) {
    throw new ProtocolError('unsupported synchronization protocol', 'QSYNC_UPGRADE_REQUIRED')
  }
  return data as RemoteDocument
}
export async function writeRemote(sb: SupabaseClient, pending: PendingWrite): Promise<WriteReceipt> {
  const { data, error, status } = await deadline(signal => sb.rpc('qsync_write', {
    p_expected_revision: pending.expected, p_operation: pending.id, p_document: pending.document,
  }).abortSignal(signal))
  if (error) throw new ProtocolError(error.message, error.code, status)
  if (!data || data.operation !== pending.id || typeof data.revision !== 'string' || !/^(0|[1-9]\d*)$/.test(data.revision)
    || !['applied', 'conflict'].includes(data.status) || typeof data.replay !== 'boolean') throw new ProtocolError('invalid synchronization acknowledgment', 'QSYNC_INVALID_ACK')
  return data as WriteReceipt
}
