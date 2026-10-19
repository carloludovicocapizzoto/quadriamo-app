import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingWrite, RemoteDocument } from './protocol'
import { supportedData } from '../store/persist'

export interface WriteReceipt { protocol: 2; status: 'applied' | 'conflict'; revision: string; operation: string; replay: boolean }
export class ProtocolError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfterSeconds?: number
  constructor(message: string, code: string, status = 0, details?: unknown) {
    super(message); this.code = code; this.status = status
    this.retryAfterSeconds = retryAfter(details)
  }
}
function retryAfter(details: unknown): number | undefined {
  if (details && typeof details === 'object' && 'retry_after_seconds' in details) {
    const seconds = Number((details as { retry_after_seconds?: unknown }).retry_after_seconds)
    return Number.isInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined
  }
  if (typeof details !== 'string') return undefined
  let value: unknown
  try { value = (JSON.parse(details) as { retry_after_seconds?: unknown }).retry_after_seconds } catch {
    value = /retry_after_seconds["']?\s*[:=]\s*["']?(\d+)/i.exec(details)?.[1]
  }
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined
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
  if (error) throw new ProtocolError(error.message, error.code, status, error.details)
  if (!data || data.protocol !== 2 || typeof data.revision !== 'string' || !/^(0|[1-9]\d*)$/.test(data.revision)
    || data.activationAllowed !== undefined && typeof data.activationAllowed !== 'boolean'
    || !['legacy', 'protected', 'paused'].includes(data.mode) || data.document !== null && (!supportedData(data.document) || data.document.demo)) {
    throw new ProtocolError('unsupported synchronization protocol', 'QSYNC_UPGRADE_REQUIRED')
  }
  return data as RemoteDocument
}
export async function writeRemote(sb: SupabaseClient, pending: PendingWrite): Promise<WriteReceipt> {
  const { data, error, status } = await deadline(signal => sb.rpc('qsync_write_v2', {
    p_expected_revision: pending.expected, p_operation: pending.id, p_document_json: JSON.stringify(pending.document),
  }).abortSignal(signal))
  if (error) throw new ProtocolError(error.message, error.code, status, error.details)
  if (data?.protocol === 2 && data.status === 'rejected' && data.operation === pending.id) {
    const code = typeof data.code === 'string' ? data.code : 'QSYNC_OPERATION_REJECTED'
    const rejectedStatus = Number.isInteger(data.httpStatus) ? data.httpStatus : status
    throw new ProtocolError(code, code, rejectedStatus, data.details)
  }
  if (!data || data.protocol !== 2 || data.operation !== pending.id || typeof data.revision !== 'string' || !/^(0|[1-9]\d*)$/.test(data.revision)
    || !['applied', 'conflict'].includes(data.status) || typeof data.replay !== 'boolean') throw new ProtocolError('invalid synchronization acknowledgment', 'QSYNC_INVALID_ACK')
  return data as WriteReceipt
}
