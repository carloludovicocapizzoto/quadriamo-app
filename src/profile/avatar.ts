// Foto profilo. Si riduce sul telefono (256x256, ritaglio al centro) prima di salvarla.
// Senza account resta su questo dispositivo; con un account va nello spazio privato "avatars" (vedi 0017_avatars.sql),
// leggibile solo dal suo proprietario, e una copia resta qui per mostrarla subito e anche offline.
import { useSyncExternalStore } from 'react'
import { supabase } from '../sync/client'
import { shrinkImage } from '../image'
import { local } from '../storage'

const KEY = 'q.avatar'
const SIZE = 256
const read = () => local.get(KEY)
let current = read()
const listeners = new Set<() => void>()
const set = (v: string | null) => {
  current = v
  local.set(KEY, v || null)
  listeners.forEach(f => f())
}
export const useAvatar = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => current)
const path = (userId: string) => `${userId}/avatar.webp`

const toDataUrl = (b: Blob) => new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b) })

export async function setAvatar(file: File, userId: string | null) {
  const blob = await shrinkImage(file, { size: SIZE, square: true })
  set(await toDataUrl(blob))   // prima qui: se il caricamento non riesce, la foto resta almeno su questo dispositivo
  if (userId && supabase) {
    const { error } = await supabase.storage.from('avatars').upload(path(userId), blob, { upsert: true, contentType: blob.type })
    if (error) throw error
  }
}

/** Toglie la foto solo da questo dispositivo (all'uscita: il telefono potrebbe passare a un'altra persona). */
export const forgetAvatar = () => set(null)

export async function removeAvatar(userId: string | null) {
  if (userId && supabase) await supabase.storage.from('avatars').remove([path(userId)])
  set(null)
}

/** All'accesso: scarica la propria foto (se c'è) su questo dispositivo. All'uscita: la toglie da qui. */
export async function loadAvatar(userId: string | null) {
  if (!userId || !supabase) return
  const { data, error } = await supabase.storage.from('avatars').download(path(userId))
  if (!error && data) set(await toDataUrl(data))
}
