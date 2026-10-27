import { createContext, useContext, type Dispatch } from 'react'
import type { Action, State } from './state'
import type { AccountStore } from './accountStore'
import type { ScopeLease } from './scope'

export const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action>; storage?: AccountStore; lease?: ScopeLease } | null>(null)

export function useStore() {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
