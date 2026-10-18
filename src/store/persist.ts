// Archivi locali separati per ambiente e proprietario. Il vecchio archivio non viene mai attribuito o cancellato.
import { get, update } from 'idb-keyval'
import type { AppData } from './state'
import { dataKey, scopeKey, type DataScope } from './scope'

const LEGACY = 'quadriamo.data.v1'
export const LEGACY_ARCHIVE = 'quadriamo.legacy.v2'
const LEGACY_KEYS = [LEGACY, 'quadriamo.inbox', 'quadriamo.morning', 'quadriamo.reminders']
interface LegacyCopy { id: string; savedAt: string; values: Record<string, unknown> }
interface Archive { format: 2; copies: LegacyCopy[] }
export interface Envelope {
  storageFormat: 2; payloadSchema: 1; savedAt: string; scope: string; revision: number; checksum: string; payload: AppData | null
}
export type LoadResult =
  | { kind: 'found'; data: AppData; revision: number }
  | { kind: 'empty'; revision: number }
  | { kind: 'unavailable' | 'corrupt' | 'unsupported'; revision: 0 }

async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
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
    if (envelope.storageFormat !== 2) return { kind: 'unsupported', revision: 0 }
    if (envelope.scope !== scopeKey(scope) || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1
      || envelope.checksum !== await checksum(envelope.payload)) return { kind: 'corrupt', revision: 0 }
    if (envelope.payload === null) return { kind: 'empty', revision: envelope.revision }
    if (!supportedData(envelope.payload)) return { kind: 'unsupported', revision: 0 }
    if (scope.kind === 'demo' && !envelope.payload.demo) return { kind: 'corrupt', revision: 0 }
    if (scope.kind === 'account' && envelope.payload.demo) return { kind: 'corrupt', revision: 0 }
    return { kind: 'found', data: envelope.payload, revision: envelope.revision }
  } catch { return { kind: 'unavailable', revision: 0 } }
}

export class StorageConflict extends Error {
  constructor() { super('cache changed in another tab') }
}
export async function saveData(scope: DataScope, data: AppData | null, expectedRevision: number): Promise<number> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw Error('invalid cache revision')
  if (scope.kind === 'guest' || (data && !supportedData(data))
    || (scope.kind === 'account' && data?.demo) || (scope.kind === 'demo' && data && !data.demo)) throw Error('invalid data scope')
  const revision = expectedRevision + 1
  let committedRevision = revision
  const envelope: Envelope = { storageFormat: 2, payloadSchema: 1, savedAt: new Date().toISOString(), scope: scopeKey(scope), revision, checksum: await checksum(data), payload: data }
  await update<Envelope>(dataKey(scope), old => {
    if (old && (old.storageFormat !== 2 || old.scope !== envelope.scope || !Number.isSafeInteger(old.revision) || old.revision < 1)) throw Error('invalid cache')
    if ((old?.revision ?? 0) !== expectedRevision) {
      // Due schede possono inizializzare la stessa cache dal medesimo documento remoto.
      // Adotta soltanto una copia identica e verificata, mantenendo revisione e metadati originali.
      if (old?.payloadSchema === 1 && old.checksum === envelope.checksum && JSON.stringify(old.payload) === JSON.stringify(data)) {
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
