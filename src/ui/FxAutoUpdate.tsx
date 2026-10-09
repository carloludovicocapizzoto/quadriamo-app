import { useEffect, useRef } from 'react'
import { fetchRates, neededCurrencies } from '../fx'
import { useStore } from '../store/context'

/** Aggiorna i cambi BCE una volta al giorno, quando l'app è online. Non mostra nulla. */
export function FxAutoUpdate({ today }: { today: string }) {
  const { state, dispatch } = useStore()
  const tried = useRef('')
  const d = state.data

  useEffect(() => {
    if (!d || !navigator.onLine) return
    const key = `${today}|${d.settings.currency}|${neededCurrencies(d).join(',')}`
    if (d.settings.fxDate === today || tried.current === key) return
    tried.current = key
    fetchRates(d.settings.currency, neededCurrencies(d)).then(({ rates, date }) => {
      if (!date) return
      const s = state.data?.settings ?? d.settings
      dispatch({ type: 'setSettings', settings: { ...s, fxRates: { ...s.fxRates, ...rates }, fxDate: today } })
    }).catch(() => { /* offline o servizio non raggiungibile: restano gli ultimi cambi */ })
  }, [d, today, dispatch, state.data])

  return null
}
