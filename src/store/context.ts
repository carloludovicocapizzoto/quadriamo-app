import { createContext, useContext, type Dispatch } from 'react'
import type { Action, State } from './state'

export const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null)

export function useStore() {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
