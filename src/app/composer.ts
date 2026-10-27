// "Nuovo movimento" / "Modifica movimento": si apre da qualsiasi schermata con openComposer().
import { useSyncExternalStore } from 'react'
import type { Transaction } from '../engine'
import { onScopeChange } from '../store/scope'

export interface ComposerState { tx?: Transaction; prefill?: { amount?: string; description?: string; category?: string } }
// open: visibile; key: cambia a ogni apertura, così il modulo riparte pulito; il contenuto resta mentre il pannello scende
let state: { open: boolean; key: number; value: ComposerState } = { open: false, key: 0, value: {} }
const listeners = new Set<() => void>()
const set = (s: typeof state) => { state = s; listeners.forEach(f => f()) }
onScopeChange(() => set({ open: false, key: state.key + 1, value: {} }))

export const openComposer = (value: ComposerState = {}) => set({ open: true, key: state.key + 1, value })
export const closeComposer = () => set({ ...state, open: false })
export const composerSnapshot = () => state
export const useComposer = () => useSyncExternalStore(f => { listeners.add(f); return () => { listeners.delete(f) } }, composerSnapshot)
