import { currentScope, personalKey, type DataScope } from './store/scope'
// La memoria del browser (localStorage). Può mancare o rifiutare (navigazione privata, spazio pieno):
// in quel caso si legge il valore di riserva e non si salva, senza errori. Tutta l'app passa da qui.
export const local = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  /** `null` cancella la chiave. Dice se è andata (falso se la memoria non è disponibile). */
  set(key: string, value: string | null): boolean {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); return true } catch { return false }
  },
  json<T>(key: string, fallback: T): T {
    try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback } catch { return fallback }
  },
  setJson(key: string, value: unknown): boolean {
    return local.set(key, JSON.stringify(value))
  },
}

/** Preferenze personali: le vecchie chiavi globali restano disponibili soltanto nel recupero legacy. */
export const personal = {
  get: (key: string) => local.get(personalKey(key)),
  set: (key: string, value: string | null) => local.set(personalKey(key), value),
  json: <T>(key: string, fallback: T) => local.json<T>(personalKey(key), fallback),
  setJson: (key: string, value: unknown) => local.setJson(personalKey(key), value),
}

/** Per callback asincrone: mantiene la destinazione anche dopo un cambio di sessione. */
export const personalFor = (scope: DataScope = currentScope().scope) => ({
  get: (key: string) => local.get(personalKey(key, scope)),
  set: (key: string, value: string | null) => local.set(personalKey(key, scope), value),
})
