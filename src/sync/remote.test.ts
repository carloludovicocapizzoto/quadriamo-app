import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ProtocolError, readRemote, writeRemote } from './remote'
import { defaultSettings } from '../engine'
import { createOperationId, type PendingWrite } from './protocol'
const document = { version: 1 as const, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }), transactions: [] }
const operation: PendingWrite = { id: createOperationId(), expected: '9007199254740993', document, localAtStart: document }
afterEach(() => vi.useRealTimers())
it('creates a UUIDv7 operation id with its bounded server-time marker', () => {
  const id = createOperationId(1_797_000_000_000)
  expect(id[14]).toBe('7'); expect(['8', '9', 'a', 'b']).toContain(id[19])
  expect(Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)).toBe(1_797_000_000_000)
})
it('accepts only the protected clean-start protocol from the server', async () => {
  const sb = { rpc: () => ({ abortSignal: () => Promise.resolve({ data: { protocol: 2, revision: '0', mode: 'protected', document: null }, error: null, status: 200 }) }) } as unknown as SupabaseClient
  await expect(readRemote(sb)).resolves.toMatchObject({ protocol: 2, revision: '0', mode: 'protected', document: null })
})
it('sends only the conditional RPC contract; identity is never supplied in a body', async () => {
  const rpc = vi.fn((_name, _body) => ({ abortSignal: () => Promise.resolve({ error: null, status: 200, data: { protocol: 2, status: 'applied', operation: operation.id, revision: '9007199254740994', replay: false } }) }))
  expect((await writeRemote({ rpc } as unknown as SupabaseClient, operation)).revision).toBe('9007199254740994')
  expect(rpc).toHaveBeenCalledWith('qsync_write_v2', { p_expected_revision: operation.expected, p_operation: operation.id, p_document_json: JSON.stringify(document) })
})
it('reads server retry-after details without changing the pending operation', () => {
  expect(new ProtocolError('QSYNC_RATE_LIMITED', 'PT429', 429, '{"retry_after_seconds":3600}')).toMatchObject({ retryAfterSeconds: 3600 })
  expect(new ProtocolError('QSYNC_RATE_LIMITED', 'PT429', 429, { retry_after_seconds: 900 })).toMatchObject({ retryAfterSeconds: 900 })
})
it('turns committed server-side rejection envelopes into errors instead of false acknowledgments', async () => {
  const rpc = vi.fn(() => ({ abortSignal: () => Promise.resolve({ error: null, status: 200, data: {
    protocol: 2, status: 'rejected', operation: operation.id, code: 'QSYNC_DOCUMENT_TOO_LARGE', httpStatus: 413,
    details: { max_bytes: 1_048_576 }, replay: false,
  } }) }))
  await expect(writeRemote({ rpc } as unknown as SupabaseClient, operation)).rejects.toMatchObject({ code: 'QSYNC_DOCUMENT_TOO_LARGE', status: 413 })
})
it('preserves retry-after from a transient byte-quota rejection envelope', async () => {
  const rpc = vi.fn(() => ({ abortSignal: () => Promise.resolve({ error: null, status: 200, data: {
    protocol: 2, status: 'rejected', operation: operation.id, code: 'QSYNC_RATE_LIMITED', httpStatus: 429,
    details: { retry_after_seconds: 3600, max_payload_bytes: 33_554_432 }, replay: false,
  } }) }))
  await expect(writeRemote({ rpc } as unknown as SupabaseClient, operation)).rejects.toMatchObject({
    code: 'QSYNC_RATE_LIMITED', status: 429, retryAfterSeconds: 3600,
  })
})
it('exposes the actual expired-receipt envelope code to conservative client recovery', async () => {
  const rpc = vi.fn(() => ({ abortSignal: () => Promise.resolve({ error: null, status: 200, data: {
    protocol: 2, status: 'rejected', operation: operation.id, code: 'QSYNC_RECEIPT_EXPIRED', httpStatus: 409, replay: false,
  } }) }))
  await expect(writeRemote({ rpc } as unknown as SupabaseClient, operation)).rejects.toMatchObject({
    code: 'QSYNC_RECEIPT_EXPIRED', status: 409,
  })
})
it('bounds the complete SDK operation even when token acquisition never finishes', async () => {
  vi.useFakeTimers(); let signal!: AbortSignal
  const rpc = vi.fn(() => ({ abortSignal: (s: AbortSignal) => { signal = s; return new Promise(() => {}) } }))
  const reading = readRemote({ rpc } as unknown as SupabaseClient)
  const rejected = expect(reading).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(15_000); await rejected; expect(signal.aborted).toBe(true)
})
it.each([{ protocol: 1, revision: '1', mode: 'protected', document }, { protocol: 2, revision: Number('9007199254740993'), mode: 'protected', document },
  { protocol: 2, revision: '1', mode: 'legacy', document, activationAllowed: 'yes' },
  { protocol: 2, revision: '1', mode: 'protected', document: { ...document, version: 99 } }])('rejects incompatible remote responses without inventing a revision', async data => {
  const sb = { rpc: () => ({ abortSignal: () => Promise.resolve({ data, error: null, status: 200 }) }) } as unknown as SupabaseClient
  await expect(readRemote(sb)).rejects.toMatchObject({ code: 'QSYNC_UPGRADE_REQUIRED' })
})
