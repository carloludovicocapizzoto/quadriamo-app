import { useEffect, useRef } from 'react'
import { fetchRates, neededCurrencies } from '../fx'
import { useStore } from '../store/context'

// Su questo dispositivo, l'ultimo controllo riuscito (giorno|valuta|valute|account): nel weekend la data dei cambi resta quella
// del venerdì, quindi senza questo segno l'app li riscaricherebbe a ogni apertura.
const CHECKED = 'quadriamo.fx.checked'
const checkedToday = () => { try { return localStorage.getItem(CHECKED) } catch { return null } }

/** Aggiorna i cambi BCE una volta al giorno, quando l'app è online. Non mostra nulla. */
export function FxAutoUpdate({ today }: { today: string }) {
  const { state, dispatch, lease } = useStore()
  const tried = useRef('')
  const d = state.data

  useEffect(() => {
    if (!d || !navigator.onLine) return
    const key = `${today}|${d.settings.currency}|${neededCurrencies(d).join(',')}|${lease ? lease.scope.kind + ':' + (lease.scope.owner ?? '') : ''}`
    if (d.settings.fxDate === today || tried.current === key || checkedToday() === key) return
    tried.current = key
    fetchRates(d.settings.currency, neededCurrencies(d)).then(({ rates, date }) => {
      if (!date || (lease && !lease.current())) return
      // con la data vera dei cambi (nel weekend e nei festivi è quella dell'ultimo giorno lavorativo), applicati dal
      // riduttore alle impostazioni di quel momento, solo se la valuta è la stessa e non sono più vecchi di quelli presenti
      dispatch({ type: 'setFx', currency: d.settings.currency, rates, date })
      try { localStorage.setItem(CHECKED, key) } catch { /* senza memoria del browser si riprova alla prossima apertura */ }
    }).catch(() => { /* offline o servizio non raggiungibile: restano gli ultimi cambi */ })
  }, [d, today, dispatch, lease])

  return null
}
