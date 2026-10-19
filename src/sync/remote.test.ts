import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readRemote, writeRemote } from './remote'
import { defaultSettings } from '../engine'
import type { PendingWrite } from './protocol'
const document = { version: 1 as const, settings: defaultSettings({ firstMonth: { year: 2026, month: 10 } }), transactions: [] }
const operation: PendingWrite = { id: crypto.randomUUID(), expected: '9007199254740993', document, localAtStart: document }
afterEach(() => vi.useRealTimers())
it('sends only the conditional RPC contract; identity is never supplied in a body', async () => {
  const rpc = vi.fn((_name, _body) => ({ abortSignal: () => Promise.resolve({ error: null, status: 200, data: { status: 'applied', operation: operation.id, revision: '9007199254740994', replay: false } }) }))
  expect((await writeRemote({ rpc } as unknown as SupabaseClient, operation)).revision).toBe('9007199254740994')
  expect(rpc).toHaveBeenCalledWith('qsync_write', { p_expected_revision: operation.expected, p_operation: operation.id, p_document: document })
})
it('bounds the complete SDK operation even when token acquisition never finishes', async () => {
  vi.useFakeTimers(); let signal!: AbortSignal
  const rpc = vi.fn(() => ({ abortSignal: (s: AbortSignal) => { signal = s; return new Promise(() => {}) } }))
  const reading = readRemote({ rpc } as unknown as SupabaseClient)
  const rejected = expect(reading).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(15_000); await rejected; expect(signal.aborted).toBe(true)
})
it.each([{ protocol: 2, revision: '1', mode: 'protected', document }, { protocol: 1, revision: Number('9007199254740993'), mode: 'protected', document },
  { protocol: 1, revision: '1', mode: 'legacy', document, activationAllowed: 'yes' },
  { protocol: 1, revision: '1', mode: 'protected', document: { ...document, version: 99 } }])('rejects incompatible remote responses without inventing a revision', async data => {
  const sb = { rpc: () => ({ abortSignal: () => Promise.resolve({ data, error: null, status: 200 }) }) } as unknown as SupabaseClient
  await expect(readRemote(sb)).rejects.toMatchObject({ code: 'QSYNC_UPGRADE_REQUIRED' })
})
