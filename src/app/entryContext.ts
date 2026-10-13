// Cosa l'ingresso offre all'app: aprire la schermata di accesso e sapere se la configurazione iniziale è in corso.
import { createContext, useContext } from 'react'

export const EntryContext = createContext<{ openLogin: () => void; inSetup: boolean }>({ openLogin: () => {}, inSetup: false })
/** Apre la schermata di accesso (da Profilo, Pro, budget comune). */
export const useEntry = () => useContext(EntryContext)
