// Messaggi brevi in basso (es. "Questo è un movimento ricorrente: si modifica nelle Impostazioni").
import { useSyncExternalStore } from 'react'

let current: { id: number; text: string } | null = null
const listeners = new Set<() => void>()
let timer = 0

export function toast(text: string, ms = 3200) {
  current = { id: Date.now(), text }
  listeners.forEach(f => f())
  clearTimeout(timer)
  timer = window.setTimeout(() => { current = null; listeners.forEach(f => f()) }, ms)
}
export const useToast = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => current)
