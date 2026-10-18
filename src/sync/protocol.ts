import type { AppData } from '../store/types'

export interface RemoteDocument { protocol: number; revision: string; mode: 'legacy' | 'protected' | 'paused'; document: AppData | null }
export interface PendingWrite { id: string; expected: string; document: AppData; localAtStart: AppData | null }
export interface DataConflict { id: string; paths: string[]; base: RemoteDocument | null; local: AppData | null; remote: RemoteDocument; cause?: 'revision' }
export interface RecoveryCopy { id: string; at: string; reason: 'resolution' | 'local-conflict' | 'retry'; local: AppData | null; remote: AppData | null; base: AppData | null }
export type CloudStatus = 'idle' | 'pending' | 'ok' | 'conflict' | 'upgrade' | 'paused'
export interface CloudState {
  format: 1; base: RemoteDocument | null; pending: PendingWrite | null; conflict: DataConflict | null
  recovery: RecoveryCopy[]; status: CloudStatus; lastAck?: { operation: string; revision: string }
  available?: boolean
}
export const emptyCloud = (): CloudState => ({ format: 1, base: null, pending: null, conflict: null, recovery: [], status: 'idle' })
export const clone = <T,>(v: T): T => structuredClone(v)
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v
export const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

export function reconcile(base: AppData | null, local: AppData | null, remote: AppData | null): { document: AppData | null; paths: string[] } {
  if (equal(local, remote) || equal(remote, base)) return { document: clone(local), paths: [] }
  if (equal(local, base)) return { document: clone(remote), paths: [] }
  if (!base || !local || !remote) return { document: null, paths: ['/document'] }
  for (const d of [base, local, remote]) {
    const ids = d.transactions.map(t => t.id)
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return { document: null, paths: ['/document'] }
  }
  const rest = (d: AppData) => Object.fromEntries(Object.entries(d).filter(([k]) => !['transactions', 'deleted', 'activity'].includes(k)))
  if (!equal(rest(base), rest(local)) || !equal(rest(base), rest(remote))) return { document: null, paths: ['/document'] }
  const entity = (d: AppData, id: string) => ({ tx: d.transactions.find(t => t.id === id), deleted: d.deleted && Object.hasOwn(d.deleted, id) ? d.deleted[id] : undefined })
  const ids = new Set([base, local, remote].flatMap(d => [...d.transactions.map(t => t.id), ...Object.keys(d.deleted ?? {})]))
  const document = clone(local), paths: string[] = []
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
    const id = path.slice('/transactions/'.length), source = choices[path] === 'local' ? conflict.local : conflict.remote.document
    const tx = source?.transactions.find(t => t.id === id)
    if (tx) merged.transactions.push(clone(tx))
    const deleted = source?.deleted && Object.hasOwn(source.deleted, id) ? source.deleted[id] : undefined
    if (deleted !== undefined) merged.deleted = { ...merged.deleted, [id]: deleted }
  }
  return merged
}
