// La memoria del browser (localStorage). Può mancare o rifiutare (navigazione privata, spazio pieno):
// in quel caso si legge il valore di riserva e non si salva, senza errori. Tutta l'app passa da qui,
// e le chiavi sono separate per ambiente (storageKey).
import { storageKey } from './env'

export const local = {
  get(key: string): string | null {
    try { return localStorage.getItem(storageKey(key)) } catch { return null }
  },
  /** `null` cancella la chiave. Dice se è andata (falso se la memoria non è disponibile). */
  set(key: string, value: string | null): boolean {
    try { if (value == null) localStorage.removeItem(storageKey(key)); else localStorage.setItem(storageKey(key), value); return true } catch { return false }
  },
  json<T>(key: string, fallback: T): T {
    try { return (JSON.parse(localStorage.getItem(storageKey(key)) ?? 'null') as T) ?? fallback } catch { return fallback }
  },
  setJson(key: string, value: unknown): boolean {
    return local.set(key, JSON.stringify(value))
  },
}
