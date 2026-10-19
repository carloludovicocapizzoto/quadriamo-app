// Archivi locali separati per ambiente e proprietario. Il vecchio archivio non viene mai attribuito o cancellato.
import { get, update } from 'idb-keyval'
import type { AppData } from './state'
import { dataKey, scopeKey, type DataScope } from './scope'
import type { CloudState, RemoteDocument } from '../sync/protocol'

const LEGACY = 'quadriamo.data.v1'
export const LEGACY_ARCHIVE = 'quadriamo.legacy.v2'
const LEGACY_KEYS = [LEGACY, 'quadriamo.inbox', 'quadriamo.morning', 'quadriamo.reminders']
interface LegacyCopy { id: string; savedAt: string; values: Record<string, unknown> }
interface Archive { format: 2; copies: LegacyCopy[] }
export interface Envelope {
  storageFormat: 2 | 3; payloadSchema: 1; savedAt: string; scope: string; revision: number; checksum: string; payload: AppData | null
  cloud?: CloudState; previous?: Envelope
}
export type LoadResult =
  | { kind: 'found'; data: AppData; revision: number; cloud?: CloudState }
  | { kind: 'empty'; revision: number; cloud?: CloudState }
  | { kind: 'unavailable' | 'corrupt' | 'unsupported'; revision: 0 }

async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}

const signed = (e: Envelope) => e.storageFormat === 3 ? { payload: e.payload, cloud: e.cloud, previous: e.previous } : e.payload
export const exportCache = (scope: DataScope) => get<Envelope>(dataKey(scope))
function supportedCloud(c: CloudState): boolean {
  const doc = (d: unknown) => d === null || supportedData(d) && !d.demo
  const remote = (r: RemoteDocument | null) => r === null || r && Number.isInteger(r.protocol) && r.protocol >= 1
    && typeof r.revision === 'string' && /^(0|[1-9]\d*)$/.test(r.revision) && ['legacy', 'protected', 'paused'].includes(r.mode) && doc(r.document)
  return !!c && c.format === 1 && !!remote(c.base) && ['idle', 'pending', 'ok', 'reconciled', 'conflict', 'upgrade', 'paused'].includes(c.status)
    && (c.cooldownUntil === undefined || typeof c.cooldownUntil === 'string' && Number.isFinite(Date.parse(c.cooldownUntil)))
    && (c.pending === null || !!c.pending && typeof c.pending.id === 'string' && typeof c.pending.expected === 'string' && /^\d+$/.test(c.pending.expected)
      && supportedData(c.pending.document) && !c.pending.document.demo && doc(c.pending.localAtStart))
    && (c.conflict === null || !!c.conflict && typeof c.conflict.id === 'string' && Array.isArray(c.conflict.paths)
      && c.conflict.paths.every(p => typeof p === 'string') && !!remote(c.conflict.base) && !!c.conflict.remote && !!remote(c.conflict.remote) && doc(c.conflict.local))
    && Array.isArray(c.recovery) && c.recovery.every(r => r && typeof r.id === 'string' && doc(r.local) && doc(r.remote) && doc(r.base))
}

/** Verifica il confine del formato senza ricostruire o scartare campi del documento finanziario. */
export function supportedData(d: unknown): d is AppData {
  if (!d || typeof d !== 'object') return false
  const v = d as AppData
  return v.version === 1 && !!v.settings && Array.isArray(v.settings.buckets) && Array.isArray(v.settings.categories)
    && (Array.isArray(v.settings.events) || Array.isArray((v.settings as { recurring?: unknown }).recurring))
    && Array.isArray(v.transactions) && (v.settings.schema ?? 0) <= 5
}

export async function readLegacyValues(): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = {}
  for (const key of LEGACY_KEYS) {
    const value = await get(key)
    if (value !== undefined) values[key] = value
  }
  // Le chiavi originali restano intatte anche se localStorage non è leggibile.
  for (const key of ['q.avatar', 'q.inboxFlags', 'q.sharedBudget', 'q.calSuggestOff', 'q.researchToken', 'q.setupPending', 'q.profilePrompt']) {
    try { const value = localStorage.getItem(key); if (value !== null) values[key] = value } catch { /* originale conservato */ }
  }
  return values
}
export async function archiveLegacy(): Promise<LegacyCopy | null> {
  const values = await readLegacyValues()
  if (!Object.keys(values).length) return null
  const id = await checksum(values)
  const existing = (await legacyCopies()).find(c => c.id === id)
  if (existing) return existing
  const copy: LegacyCopy = { id, savedAt: new Date().toISOString(), values }
  await update<Archive>(LEGACY_ARCHIVE, old => {
    if (old && (old.format !== 2 || !Array.isArray(old.copies))) throw Error('invalid legacy archive')
    return old?.copies.some(c => c.id === id) ? old : { format: 2, copies: [...(old?.copies ?? []), copy] }
  })
  const saved = (await get<Archive>(LEGACY_ARCHIVE))?.copies.find(c => c.id === id)
  if (!saved || await checksum(saved.values) !== id) throw Error('legacy copy verification failed')
  return saved
}

export async function legacyCopies(): Promise<LegacyCopy[]> {
  const archive = await get<Archive>(LEGACY_ARCHIVE)
  if (!archive) return []
  if (archive.format !== 2 || !Array.isArray(archive.copies)) throw Error('invalid legacy archive')
  for (const copy of archive.copies) if (await checksum(copy.values) !== copy.id) throw Error('corrupt legacy copy')
  return archive.copies
}
export async function recoverLegacy(id: string): Promise<AppData> {
  const copy = (await legacyCopies()).find(c => c.id === id)
  const data = copy?.values[LEGACY]
  if (!supportedData(data)) throw Error('unsupported legacy data')
  return structuredClone(data)
}

export async function loadData(scope: DataScope): Promise<LoadResult> {
  try {
    await archiveLegacy()
    const envelope = await get<Envelope>(dataKey(scope))
    if (!envelope) return { kind: 'empty', revision: 0 }
    if (![2, 3].includes(envelope.storageFormat)) return { kind: 'unsupported', revision: 0 }
    if (envelope.scope !== scopeKey(scope) || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1
      || envelope.payloadSchema !== 1 || envelope.checksum !== await checksum(signed(envelope))) return { kind: 'corrupt', revision: 0 }
    if (envelope.storageFormat === 3 && (scope.kind !== 'account' || !supportedCloud(envelope.cloud!))) return { kind: 'corrupt', revision: 0 }
    if (envelope.payload === null) return { kind: 'empty', revision: envelope.revision, cloud: envelope.cloud }
    if (!supportedData(envelope.payload)) return { kind: 'unsupported', revision: 0 }
    if (scope.kind === 'demo' && !envelope.payload.demo) return { kind: 'corrupt', revision: 0 }
    if (scope.kind === 'account' && envelope.payload.demo) return { kind: 'corrupt', revision: 0 }
    return { kind: 'found', data: envelope.payload, revision: envelope.revision, cloud: envelope.cloud }
  } catch { return { kind: 'unavailable', revision: 0 } }
}

export class StorageConflict extends Error {
  constructor() { super('cache changed in another tab') }
}
export async function saveData(scope: DataScope, data: AppData | null, expectedRevision: number, cloud?: CloudState): Promise<number> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw Error('invalid cache revision')
  if (scope.kind === 'guest' || (data && !supportedData(data))
    || (scope.kind === 'account' && data?.demo) || (scope.kind === 'demo' && data && !data.demo)) throw Error('invalid data scope')
  if (cloud && (scope.kind !== 'account' || !supportedCloud(cloud))) throw Error('invalid sync metadata')
  const revision = expectedRevision + 1
  let committedRevision = revision
  const original = cloud ? await get<Envelope>(dataKey(scope)) : undefined
  if (original && original.checksum !== await checksum(signed(original))) throw Error('invalid cache')
  const envelope: Envelope = { storageFormat: cloud ? 3 : 2, payloadSchema: 1, savedAt: new Date().toISOString(), scope: scopeKey(scope), revision, checksum: '', payload: data,
    ...(cloud ? { cloud, ...(original ? { previous: original.storageFormat === 2 ? original : original.previous } : {}) } : {}) }
  envelope.checksum = await checksum(signed(envelope))
  await update<Envelope>(dataKey(scope), old => {
    if (old && (![2, 3].includes(old.storageFormat) || old.scope !== envelope.scope || !Number.isSafeInteger(old.revision) || old.revision < 1
      || old.storageFormat === 3 && !cloud)) throw Error('invalid cache')
    if ((old?.revision ?? 0) !== expectedRevision) {
      // Due schede possono inizializzare la stessa cache dal medesimo documento remoto.
      // Adotta soltanto una copia identica e verificata, mantenendo revisione e metadati originali.
      if (old?.payloadSchema === 1 && old.storageFormat === envelope.storageFormat && old.checksum === envelope.checksum && JSON.stringify(signed(old)) === JSON.stringify(signed(envelope))) {
        committedRevision = old.revision
        return old
      }
      throw new StorageConflict()
    }
    return envelope
  })
  return committedRevision
}

/** Chiede al browser di non cancellare i dati quando lo spazio scarseggia (dove supportato). */
export async function requestPersistence(): Promise<void> {
  try { await navigator.storage?.persist?.() } catch { /* non supportato */ }
}
