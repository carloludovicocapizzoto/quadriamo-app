// Foto profilo. Si riduce sul telefono (256x256, ritaglio al centro) prima di salvarla.
// Senza account resta su questo dispositivo; con un account va nello spazio privato "avatars" (vedi 0017_avatars.sql),
// leggibile solo dal suo proprietario, e una copia resta qui per mostrarla subito e anche offline.
import { useSyncExternalStore } from 'react'
import { supabase } from '../sync/client'

const KEY = 'q.avatar'
const SIZE = 256
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
let current = read()
const listeners = new Set<() => void>()
const set = (v: string | null) => {
  current = v
  try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY) } catch { /* niente */ }
  listeners.forEach(f => f())
}
export const useAvatar = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => current)
const path = (userId: string) => `${userId}/avatar.webp`

/** Riduce un'immagine a un quadrato di 256 px (ritaglio al centro). WebP dove il browser lo sa scrivere, altrimenti JPEG. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.85))
  return blob && blob.type === 'image/webp' ? blob : await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.85))
}
const toDataUrl = (b: Blob) => new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b) })

export async function setAvatar(file: File, userId: string | null) {
  const blob = await shrink(file)
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
