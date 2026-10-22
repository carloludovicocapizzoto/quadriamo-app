import type { AppData } from '../store/types'

export interface RemoteDocument { protocol: number; revision: string; mode: 'legacy' | 'protected' | 'paused'; document: AppData | null; activationAllowed?: boolean }
export interface PendingWrite { id: string; expected: string; document: AppData; localAtStart: AppData | null }
export interface DataConflict { id: string; paths: string[]; base: RemoteDocument | null; local: AppData | null; remote: RemoteDocument; cause?: 'revision' | 'expired-receipt' }
export interface RecoveryCopy { id: string; at: string; reason: 'resolution' | 'local-conflict' | 'retry' | 'expired-receipt'; local: AppData | null; remote: AppData | null; base: AppData | null }
export type CloudStatus = 'idle' | 'pending' | 'ok' | 'reconciled' | 'conflict' | 'upgrade' | 'paused'
export interface CloudState {
  format: 1; base: RemoteDocument | null; pending: PendingWrite | null; conflict: DataConflict | null
  recovery: RecoveryCopy[]; status: CloudStatus; lastAck?: { operation: string; revision: string }
  available?: boolean; cooldownUntil?: string
  activationBlocked?: boolean
}
export const emptyCloud = (): CloudState => ({ format: 1, base: null, pending: null, conflict: null, recovery: [], status: 'idle' })
export const clone = <T,>(v: T): T => structuredClone(v)
/** UUIDv7 embeds the creation time so the server can reject an unreceipted replay after retention. */
export function createOperationId(now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || BigInt(now) >= (1n << 48n)) throw Error('invalid operation time')
  const bytes = crypto.getRandomValues(new Uint8Array(16)), timestamp = BigInt(now)
  for (let i = 5; i >= 0; i--) bytes[i] = Number((timestamp >> BigInt((5 - i) * 8)) & 255n)
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v
export const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

export const EVENT = '/settings/events/'
type Fields = Record<string, unknown>
const isFields = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v)
/** One field as seen by one copy: [] when absent, [value] when present, so a removal counts as a change. */
const slot = (o: Fields, key: string): unknown[] => Object.hasOwn(o, key) ? [o[key]] : []
/** Three-way choice: the side that changed wins; null when both changed it differently. */
const pick = (b: unknown[], l: unknown[], r: unknown[]): unknown[] | null => equal(l, r) || equal(r, b) ? l : equal(l, b) ? r : null
const put = (out: Fields, key: string, value: unknown[]) => { if (value.length) out[key] = clone(value[0]); else delete out[key] }
const keys = (...objects: Fields[]) => new Set(objects.flatMap(o => Object.keys(o)))

/**
 * Field-level three-way merge of everything except `skip` (handled by the caller). Bookkeeping timestamps
 * (`…UpdatedAt`) never conflict; settings and calendar events merge deeper. Null = the same field was
 * changed differently on both copies: only then a whole-document choice is needed.
 */
function mergeFields(base: Fields, local: Fields, remote: Fields, skip: string[], paths: string[]): Fields | null {
  const out = clone(local)
  for (const key of keys(base, local, remote)) {
    if (skip.includes(key)) continue
    const b = slot(base, key), l = slot(local, key), r = slot(remote, key)
    if (key.endsWith('UpdatedAt')) { put(out, key, [...l, ...r].map(String).sort().slice(-1)); continue }
    if (key === 'settings' && [b, l, r].every(s => isFields(s[0]))) {
      const settings = mergeSettings(b[0] as Fields, l[0] as Fields, r[0] as Fields, paths)
      if (!settings) return null
      out[key] = settings; continue
    }
    const value = pick(b, l, r)
    if (!value) return null
    put(out, key, value)
  }
  return out
}

function mergeSettings(base: Fields, local: Fields, remote: Fields, paths: string[]): Fields | null {
  const out = mergeFields(base, local, remote, ['events', 'fxRates', 'fxDate'], paths)
  if (!out) return null
  if ([base, local, remote].every(s => Array.isArray(s.events))) {
    const events = mergeEvents(base.events as Fields[], local.events as Fields[], remote.events as Fields[], paths)
    if (!events) return null
    out.events = events
  } else {
    const value = pick(slot(base, 'events'), slot(local, 'events'), slot(remote, 'events'))
    if (!value) return null
    put(out, 'events', value)
  }
  // Automatic exchange rates are a cache of public data, not a choice of the user: they follow the merged
  // currency and the latest download wins (remote on a tie), so a daily refresh on two devices never conflicts.
  const sides = [remote, local].filter(s => s.currency === out.currency)
  if (!sides.length) return out
  const latest = sides.reduce((a, s) => String(s.fxDate ?? '') > String(a.fxDate ?? '') ? s : a), other = sides.find(s => s !== latest)
  if (sides.some(s => isFields(s.fxRates))) out.fxRates = { ...(isFields(other?.fxRates) ? other.fxRates : {}), ...(isFields(latest.fxRates) ? latest.fxRates : {}) }
  put(out, 'fxDate', slot(latest, 'fxDate'))
  return out
}

/** Calendar events (subscriptions, bills, documents…) merge one by one, like transactions: an addition or a removal on one copy survives. */
function mergeEvents(base: Fields[], local: Fields[], remote: Fields[], paths: string[]): Fields[] | null {
  const lists = [base, local, remote]
  if (lists.some(list => list.some(e => !isFields(e) || typeof e.id !== 'string' || !e.id) || new Set(list.map(e => e.id)).size !== list.length)) return null
  const [b, l, r] = lists.map(list => new Map(list.map(e => [e.id as string, e]))), out: Fields[] = []
  for (const id of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
    const before = b.get(id), left = l.get(id), right = r.get(id)
    const value = pick(before ? [before] : [], left ? [left] : [], right ? [right] : []) ?? (before && left && right ? mergeEvent(before, left, right) : null)
    if (!value) { paths.push(EVENT + id); continue }
    if (value.length) out.push(clone(value[0] as Fields))
  }
  return out
}

/** Two edits of the same event combine when they touch different fields; the paid dates (`done`) merge as a set. */
function mergeEvent(base: Fields, local: Fields, remote: Fields): unknown[] | null {
  const out = clone(local)
  for (const key of keys(base, local, remote)) {
    const b = slot(base, key), l = slot(local, key), r = slot(remote, key)
    if (key === 'done' && [b, l, r].every(s => Array.isArray(s[0]))) {
      const [before, left, right] = [b, l, r].map(s => s[0] as unknown[])
      out.done = [...new Set([...left, ...right])].filter(day => left.includes(day) && right.includes(day) || !before.includes(day)).map(String).sort()
      continue
    }
    const value = pick(b, l, r)
    if (!value) return null
    put(out, key, value)
  }
  return [out]
}

export function reconcile(base: AppData | null, local: AppData | null, remote: AppData | null): { document: AppData | null; paths: string[] } {
  if (equal(local, remote) || equal(remote, base)) return { document: clone(local), paths: [] }
  if (equal(local, base)) return { document: clone(remote), paths: [] }
  if (!base || !local || !remote) return { document: null, paths: ['/document'] }
  for (const d of [base, local, remote]) {
    const ids = d.transactions.map(t => t.id)
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return { document: null, paths: ['/document'] }
  }
  const paths: string[] = []
  const document = mergeFields(base as unknown as Fields, local as unknown as Fields, remote as unknown as Fields, ['transactions', 'deleted', 'activity'], paths) as unknown as AppData | null
  if (!document) return { document: null, paths: ['/document'] }
  const entity = (d: AppData, id: string) => ({ tx: d.transactions.find(t => t.id === id), deleted: d.deleted && Object.hasOwn(d.deleted, id) ? d.deleted[id] : undefined })
  const ids = new Set([base, local, remote].flatMap(d => [...d.transactions.map(t => t.id), ...Object.keys(d.deleted ?? {})]))
  document.transactions = []; document.deleted = Object.create(null)
  for (const id of ids) {
    const b = entity(base, id), l = entity(local, id), r = entity(remote, id)
    let next: typeof l
    if (equal(l, r) || equal(r, b)) next = l
    else if (equal(l, b)) next = r
    else { paths.push('/transactions/' + id); continue }
    if (next.tx) document.transactions.push(clone(next.tx))
    if (next.deleted !== undefined) document.deleted![id] = next.deleted
  }
  const before = base.activity ?? [], left = local.activity ?? [], right = remote.activity ?? []
  if (!equal(left, right) && !equal(left, before) && !equal(right, before)
    && before.some(day => !left.includes(day) || !right.includes(day))) return { document: null, paths: ['/document'] }
  if (base.activity || local.activity || remote.activity) document.activity = equal(left, before) ? clone(right) : equal(right, before) ? clone(left) : [...new Set([...left, ...right])].sort()
  return { document, paths }
}

/** Selezione esplicita; la versione scartata viene archiviata dal chiamante prima dell'upload. */
export function resolveConflict(conflict: DataConflict, choices: Record<string, 'local' | 'remote'>): AppData | null {
  if (conflict.paths.some(path => !['local', 'remote'].includes(choices[path]))) throw Error('incomplete conflict decision')
  if (conflict.paths.includes('/document')) return clone(choices['/document'] === 'local' ? conflict.local : conflict.remote.document)
  const merged = reconcile(conflict.base?.document ?? null, conflict.local, conflict.remote.document).document
  if (!merged) throw Error('invalid conflict')
  for (const path of conflict.paths) {
    const source = choices[path] === 'local' ? conflict.local : conflict.remote.document
    if (path.startsWith(EVENT)) {
      const event = source?.settings.events.find(e => e.id === path.slice(EVENT.length))
      if (event) merged.settings.events.push(clone(event))
      continue
    }
    const id = path.slice('/transactions/'.length)
    const tx = source?.transactions.find(t => t.id === id)
    if (tx) merged.transactions.push(clone(tx))
    const deleted = source?.deleted && Object.hasOwn(source.deleted, id) ? source.deleted[id] : undefined
    if (deleted !== undefined) merged.deleted = { ...merged.deleted, [id]: deleted }
  }
  return merged
}
