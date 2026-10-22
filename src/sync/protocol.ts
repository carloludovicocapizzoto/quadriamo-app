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
/** The user's decision for each conflicting path ('/document', '/transactions/<id>', '/settings/currency', '/settings/events/<id>'…). */
export type Choices = Record<string, 'local' | 'remote'>
type Fields = Record<string, unknown>
interface Merge { paths: string[]; choices: Choices }
const isFields = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v)
/** One field as seen by one copy: [] when absent, [value] when present, so a removal counts as a change. */
const slot = (o: Fields, key: string): unknown[] => Object.hasOwn(o, key) ? [o[key]] : []
/** Three-way choice: the side that changed wins; null when both changed it differently. */
const pick = (b: unknown[], l: unknown[], r: unknown[]): unknown[] | null => equal(l, r) || equal(r, b) ? l : equal(l, b) ? r : null
const put = (out: Fields, key: string, value: unknown[]) => { if (value.length) out[key] = clone(value[0]); else delete out[key] }
const keys = (...objects: Fields[]) => new Set(objects.flatMap(o => Object.keys(o)))
const latest = (l: unknown[], r: unknown[]) => [...l, ...r].map(String).sort().slice(-1)
/** Sets (paid dates, active days): an addition or a removal made on either copy is kept. */
const mergeSet = (before: unknown[], left: unknown[], right: unknown[]) =>
  [...new Set([...left, ...right])].filter(x => left.includes(x) && right.includes(x) || !before.includes(x)).map(String).sort()
/** Lists of records with an `id` that merge item by item, per parent path. */
const BY_ID: Record<string, string[]> = { '': ['goals'], '/settings': ['events', 'categories', 'rules'] }

/** A value changed differently on both copies is asked once, by its path, then taken from the chosen copy. */
function decide(b: unknown[], l: unknown[], r: unknown[], path: string, m: Merge): unknown[] | null {
  const value = pick(b, l, r)
  if (value) return value
  if (m.choices[path]) return m.choices[path] === 'local' ? l : r
  m.paths.push(path); return null
}

/**
 * Field-level three-way merge of everything except `skip` (handled by the caller). Bookkeeping timestamps
 * (`…UpdatedAt`) never conflict; settings and lists with ids merge deeper. Only a field changed differently
 * on both copies becomes a question, for that field alone: everything else is already merged.
 */
function mergeFields(base: Fields, local: Fields, remote: Fields, prefix: string, skip: string[], m: Merge): Fields {
  const out = clone(local)
  for (const key of keys(base, local, remote)) {
    if (skip.includes(key)) continue
    const b = slot(base, key), l = slot(local, key), r = slot(remote, key), path = prefix + '/' + key
    if (key.endsWith('UpdatedAt')) { put(out, key, latest(l, r)); continue }
    if (key === 'settings' && !prefix && [b, l, r].every(s => isFields(s[0]))) { out[key] = mergeSettings(b[0] as Fields, l[0] as Fields, r[0] as Fields, m); continue }
    if (BY_ID[prefix]?.includes(key) && [b, l, r].every(s => !s.length || Array.isArray(s[0])) && !pick(b, l, r)) {
      // a list missing on one copy (e.g. no goals yet) counts as empty
      const list = mergeById(...[b, l, r].map(s => (s[0] ?? []) as Fields[]) as [Fields[], Fields[], Fields[]], path, m)
      if (list) { out[key] = list; continue }
    }
    const value = decide(b, l, r, path, m)
    if (value) put(out, key, value)
  }
  return out
}

function mergeSettings(base: Fields, local: Fields, remote: Fields, m: Merge): Fields {
  const out = mergeFields(base, local, remote, '/settings', ['fxRates', 'fxDate'], m)
  // Automatic exchange rates are a cache of public data, not a choice of the user: they follow the merged
  // currency and the most recent rates win (remote on a tie), so a daily refresh on two devices never conflicts.
  const sides = [remote, local].filter(s => s.currency === out.currency)
  if (!sides.length) return out
  const newest = sides.reduce((a, s) => String(s.fxDate ?? '') > String(a.fxDate ?? '') ? s : a), other = sides.find(s => s !== newest)
  if (sides.some(s => isFields(s.fxRates))) out.fxRates = { ...(isFields(other?.fxRates) ? other.fxRates : {}), ...(isFields(newest.fxRates) ? newest.fxRates : {}) }
  put(out, 'fxDate', slot(newest, 'fxDate'))
  return out
}

/** Calendar events, categories, rules, goals merge one by one, like transactions: an addition or a removal on one copy survives. Null = ids unusable. */
function mergeById(base: Fields[], local: Fields[], remote: Fields[], path: string, m: Merge): Fields[] | null {
  const lists = [base, local, remote]
  if (lists.some(list => list.some(e => !isFields(e) || typeof e.id !== 'string' || !e.id) || new Set(list.map(e => e.id)).size !== list.length)) return null
  const [b, l, r] = lists.map(list => new Map(list.map(e => [e.id as string, e]))), out: Fields[] = []
  for (const id of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
    const before = b.get(id), left = l.get(id), right = r.get(id), at = path + '/' + id
    let value = pick(before ? [before] : [], left ? [left] : [], right ? [right] : []) ?? (before && left && right ? mergeItem(before, left, right) : null)
    if (!value && m.choices[at]) { const chosen = m.choices[at] === 'local' ? left : right; value = chosen ? [chosen] : [] }
    if (!value) { m.paths.push(at); continue }
    if (value.length) out.push(clone(value[0] as Fields))
  }
  return out
}

/** Two edits of the same item combine when they touch different fields; the paid dates (`done`) merge as a set. */
function mergeItem(base: Fields, local: Fields, remote: Fields): unknown[] | null {
  const out = clone(local)
  for (const key of keys(base, local, remote)) {
    const b = slot(base, key), l = slot(local, key), r = slot(remote, key)
    if (key === 'done' && [b, l, r].every(s => Array.isArray(s[0]))) { out.done = mergeSet(b[0] as unknown[], l[0] as unknown[], r[0] as unknown[]); continue }
    if (/^updatedAt$|UpdatedAt$/.test(key)) { put(out, key, latest(l, r)); continue }
    const value = pick(b, l, r)
    if (!value) return null
    put(out, key, value)
  }
  return [out]
}

/**
 * A category removed on one copy while the other copy added or changed something that uses it comes back,
 * so the new item never points to a category that no longer exists. Untouched old items do not revive it.
 */
function keepUsedCategories(base: AppData, local: AppData, remote: AppData, document: AppData) {
  const s = document.settings
  if (!Array.isArray(s?.categories) || !Array.isArray(s.events)) return
  const have = new Set(s.categories.map(c => c.id))
  const known = new Map([base, remote, local].flatMap(d => d.settings.categories ?? []).map(c => [c.id, c]))
  const touched = <T extends { id: string }>(items: T[], before: T[] = []) => items.filter(x => !equal(x, before.find(y => y.id === x.id)))
  const used = [...touched(s.events, base.settings.events), ...touched(document.transactions, base.transactions), ...touched(s.rules ?? [], base.settings.rules)]
  for (const { category } of used) if (category && !have.has(category) && known.has(category)) { s.categories.push(clone(known.get(category)!)); have.add(category) }
}

export function reconcile(base: AppData | null, local: AppData | null, remote: AppData | null, choices: Choices = {}): { document: AppData | null; paths: string[] } {
  if (equal(local, remote) || equal(remote, base)) return { document: clone(local), paths: [] }
  if (equal(local, base)) return { document: clone(remote), paths: [] }
  if (!base || !local || !remote) return { document: null, paths: ['/document'] }
  for (const d of [base, local, remote]) {
    const ids = d.transactions.map(t => t.id)
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return { document: null, paths: ['/document'] }
  }
  const m: Merge = { paths: [], choices }
  const document = mergeFields(base as unknown as Fields, local as unknown as Fields, remote as unknown as Fields, '', ['transactions', 'deleted', 'activity'], m) as unknown as AppData
  const entity = (d: AppData, id: string) => ({ tx: d.transactions.find(t => t.id === id), deleted: d.deleted && Object.hasOwn(d.deleted, id) ? d.deleted[id] : undefined })
  const ids = new Set([base, local, remote].flatMap(d => [...d.transactions.map(t => t.id), ...Object.keys(d.deleted ?? {})]))
  document.transactions = []; document.deleted = Object.create(null)
  for (const id of ids) {
    const b = entity(base, id), l = entity(local, id), r = entity(remote, id), path = '/transactions/' + id
    let next: typeof l
    if (equal(l, r) || equal(r, b)) next = l
    else if (equal(l, b)) next = r
    else if (choices[path]) next = choices[path] === 'local' ? l : r
    else { m.paths.push(path); continue }
    if (next.tx) document.transactions.push(clone(next.tx))
    if (next.deleted !== undefined) document.deleted![id] = next.deleted
  }
  if (base.activity || local.activity || remote.activity) document.activity = mergeSet(base.activity ?? [], local.activity ?? [], remote.activity ?? []).slice(-400)
  else delete document.activity
  keepUsedCategories(base, local, remote, document)
  return { document, paths: m.paths }
}

/** Selezione esplicita; la versione scartata viene archiviata dal chiamante prima dell'upload. */
export function resolveConflict(conflict: DataConflict, choices: Choices): AppData | null {
  if (conflict.paths.some(path => !['local', 'remote'].includes(choices[path]))) throw Error('incomplete conflict decision')
  if (conflict.paths.includes('/document')) return clone(choices['/document'] === 'local' ? conflict.local : conflict.remote.document)
  const merged = reconcile(conflict.base?.document ?? null, conflict.local, conflict.remote.document, choices)
  if (!merged.document || merged.paths.length) throw Error('invalid conflict')
  return merged.document
}

/** The value at a conflict path inside one copy (lists with ids are addressed by id). Presentation only. */
export function valueAt(document: AppData | null, path: string): unknown {
  let value: unknown = document
  for (const part of path.split('/').slice(1)) {
    if (Array.isArray(value)) value = value.find(item => isFields(item) && item.id === part)
    else value = isFields(value) ? value[part] : undefined
  }
  return value
}
