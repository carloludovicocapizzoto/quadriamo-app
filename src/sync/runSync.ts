import { mergeData, type AppData } from '../store/state'
import { supportedData } from '../store/persist'
import type { ScopeLease } from '../store/scope'

export interface SyncJob {
  lease: ScopeLease
  local: () => AppData | null
  replace: (data: AppData) => void
  flush: () => Promise<void>
  fetch: () => Promise<AppData | null>
  push: (data: AppData) => Promise<void>
}
export async function runSync(job: SyncJob): Promise<boolean> {
  const { lease } = job
  if (!lease.current() || lease.scope.kind !== 'account') return false
  await job.flush()
  if (!lease.current()) return false
  const remote = await job.fetch()
  if (!lease.current()) return false
  if (remote && (!supportedData(remote) || remote.demo)) throw Error('unsupported remote data')
  const local = job.local()
  if (local?.demo) throw Error('demo cannot sync')
  const merged = local ? remote ? mergeData(local, remote) : local : remote
  if (merged) {
    if (JSON.stringify(merged) !== JSON.stringify(local)) job.replace(merged)
    await job.flush()
    if (!lease.current()) return false
    await job.push(merged)
    if (!lease.current()) return false
  }
  return true
}
