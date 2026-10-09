import { useEffect, useReducer, useRef, type ReactNode } from 'react'
import { StoreContext } from './context'
import { loadData, requestPersistence, saveData } from './persist'
import { reducer } from './state'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { loaded: false, data: null })
  const first = useRef(true)

  useEffect(() => {
    loadData().then(data => dispatch({ type: 'load', data }))
    requestPersistence()
  }, [])

  // salva a ogni modifica, ma non subito dopo il caricamento
  useEffect(() => {
    if (!state.loaded) return
    if (first.current) { first.current = false; return }
    saveData(state.data)
  }, [state.loaded, state.data])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}
