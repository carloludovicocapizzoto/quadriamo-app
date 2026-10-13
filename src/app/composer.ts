// "Nuovo movimento" / "Modifica movimento": si apre da qualsiasi schermata con openComposer().
import { useSyncExternalStore } from 'react'
import type { Transaction } from '../engine'

export interface ComposerState { tx?: Transaction; prefill?: { amount?: string; description?: string; category?: string } }
let state: ComposerState | null = null
const listeners = new Set<() => void>()
const set = (s: ComposerState | null) => { state = s; listeners.forEach(f => f()) }

export const openComposer = (s: ComposerState = {}) => set(s)
export const closeComposer = () => set(null)
export const useComposer = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, () => state)
