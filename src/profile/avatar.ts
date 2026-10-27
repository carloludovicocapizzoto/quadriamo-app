// La foto offline ha lo stesso proprietario del budget; i download vecchi non aggiornano il nuovo account.
import { useSyncExternalStore } from 'react'
import { scopedClient } from '../sync/scopedClient'
import { shrinkImage } from '../image'
import { local } from '../storage'
import { currentScope, onScopeChange, personalKey, type ScopeLease } from '../store/scope'

const KEY = 'q.avatar'
const listeners = new Set<() => void>()
export const avatarSnapshot = () => local.get(personalKey(KEY))
const emit = () => listeners.forEach(f => f())
onScopeChange(emit)
export const useAvatar = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, avatarSnapshot, () => null)
const path = (userId: string) => userId + '/avatar.webp'
const toDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(b)
})
function write(value: string | null, lease: ScopeLease) {
  lease.assert()
  if (!local.set(personalKey(KEY, lease.scope), value)) throw Error('avatar cache unavailable')
  emit()
}
function clientFor(userId: string | null, lease: ScopeLease) {
  lease.assert()
  if (userId && (lease.scope.kind !== 'account' || lease.scope.owner !== userId)) throw Error('avatar owner mismatch')
  return userId ? scopedClient(lease) : null
}

export async function setAvatar(file: File, userId: string | null) {
  const lease = currentScope(), sb = clientFor(userId, lease)
  const blob = await shrinkImage(file, { size: 256, square: true })
  lease.assert()
  const url = await toDataUrl(blob)
  write(url, lease)
  if (userId && sb) {
    const { error } = await sb.storage.from('avatars').upload(path(userId), blob, { upsert: true, contentType: blob.type })
    lease.assert()
    if (error) throw error
  }
}

/** Il cambio scope nasconde la foto senza eliminare la cache offline del proprietario. */
export const forgetAvatar = () => emit()
export async function removeAvatar(userId: string | null) {
  const lease = currentScope(), sb = clientFor(userId, lease)
  if (userId && sb) {
    const { error } = await sb.storage.from('avatars').remove([path(userId)])
    lease.assert()
    if (error) throw error
  }
  write(null, lease)
}
export async function loadAvatar(userId: string | null) {
  const lease = currentScope(), sb = clientFor(userId, lease)
  if (!userId || !sb) return
  const { data, error } = await sb.storage.from('avatars').download(path(userId))
  lease.assert()
  if (!error && data) write(await toDataUrl(data), lease)
}
