import { useCallback, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { note } from '../app/diagnostics'
import { StoreContext } from './context'
import { loadData, requestPersistence, saveData } from './persist'
import { reducer, type Action } from './state'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, apply] = useReducer(reducer, { loaded: false, data: null })
  // ogni azione finisce nel diario tecnico, solo col suo tipo (mai importi o testi)
  const dispatch = useCallback((a: Action) => { note('action', a.type); apply(a) }, [])
  const first = useRef(true)

  useEffect(() => {
    loadData().then(data => apply({ type: 'load', data }))
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
