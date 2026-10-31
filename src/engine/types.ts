// Modello dati di Quadriamo. Le date sono stringhe ISO "YYYY-MM-DD" (niente fusi orari).
import type { Rule } from './rules'

export type CategoryType = 'income' | 'expense' | 'saving'

export interface Bucket {
  id: string
  name: string
  share: number            // quota delle entrate, 0..1 (le quattro sommano 1)
  startingBalance: number  // saldo iniziale nel primo mese tracciato
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  defaultBucket: string | null   // spese: id del bucket o FIRST. Entrate: null = con la regola, id del bucket = tutta lì, CUSTOM = con `split`
  split?: Record<string, number> // entrate divise "a modo mio": quota per bucket (somma 1)
}

/** Il vecchio "pagamento ricorrente" (fino allo schema 4): si legge ancora da dati e backup di prima, poi diventa un evento. */
export interface Recurring {
  name: string
  amount: number
  category: string         // id categoria
  day: number | null       // giorno del mese; null = primo giorno del periodo
  active: boolean
  until?: string           // "YYYY-MM": ultimo mese (rata di un finanziamento); senza = continua finché è attivo
}

export interface Settings {
  currency: string                  // valuta dell'utente, es. "EUR"
  monthStartDay: number             // 1..28: il periodo "maggio" va dal giorno X di aprile al giorno X-1 di maggio
  firstMonth: YearMonth             // primo mese tracciato: qui si applicano i saldi iniziali
  buckets: Bucket[]
  categories: Category[]
  events: import('./calendar').CalEvent[]   // calendario: pagamenti, entrate, scadenze, promemoria (engine/calendar)
  fxRates: Record<string, number>   // 1 unità della valuta = rate unità della tua valuta (automatici, BCE)
  fxManual?: Record<string, number> // cambi scritti a mano: hanno la precedenza su quelli automatici
  fxDate?: string                   // data dei cambi automatici
  rules?: Rule[]                    // regole a parole chiave per riconoscere le transazioni importate
  persona?: 'student' | 'worker' | 'other'   // risposta a "Chi sei?" al primo avvio
  schema?: number                   // aggiornamenti dei dati già applicati (vedi migrate)
  capital?: import('./capital').Capital | null   // capitale iniziale (engine/capital): separato dal budget del mese
  homeWidgetSizes?: Record<string, 's' | 'm' | 'l'>   // taglia scelta per ogni widget (vuoto = quella di partenza)
  homeFavs?: string[]               // widget preferiti: sempre in cima alla Home
  notify?: import('./reminders').NotifyPrefs   // preferenze delle notifiche (vuoto = quelle di partenza)
  homeWidgets?: string[]            // i widget della Home, in ordine (vuoto = quelli di partenza, vedi ui/home/widgets)
}

export const SPLIT = 'split' as const   // entrata divisa secondo la regola
/** "Prima delle parti": una spesa (es. l'affitto) pagata con le entrate prima di dividerle nelle quattro parti. */
export const FIRST = 'first' as const
/** Entrata divisa "a modo mio": quote scelte dall'utente (sul movimento o sulla categoria) invece della regola. */
export const CUSTOM = 'custom' as const

export interface Transaction {
  id: string
  date: string | null
  description: string
  category: string | null           // id categoria
  amount: number | null
  currency?: string | null          // vuota = valuta dell'utente
  paidFrom?: string | null          // id bucket; per le entrate anche SPLIT (la regola) o CUSTOM (con `split`). Vuoto = come la categoria
  split?: Record<string, number> | null   // quote per bucket quando paidFrom è CUSTOM (somma 1)
  updatedAt?: string                // ISO, ultima modifica: serve alla sincronizzazione tra dispositivi
  fxRate?: number | null            // cambio del giorno in cui è stato registrato (1 unità = fxRate della tua valuta)
  occurrence?: Occurrence | null    // la volta di una spesa fissa che questo movimento paga: quella automatica non conta più
}

/** Una volta di un evento del calendario (la spesa fissa di un giorno). */
export interface Occurrence { eventId: string; date: string }

export interface YearMonth { year: number; month: number }   // month 1..12

export type TxType = CategoryType | 'unknown'

/** Movimento con i campi calcolati (come le colonne grigie dell'Excel). */
export interface ClassifiedTx extends Transaction {
  type: TxType | null               // null = senza categoria
  bucket: string | null             // id bucket, SPLIT per le entrate divise, null se non determinabile
  amountIn: number | null           // importo nella valuta dell'utente; null se manca il cambio o l'importo
  recurring?: boolean               // viene da un evento del calendario (affitto, bolletta, rata…)
  upcoming?: boolean                // non ancora arrivato al suo giorno: l'importo non conta ancora
  planned?: number                  // l'importo previsto dall'evento (anche quando è ancora in arrivo)
  eventId?: string                  // l'evento del calendario da cui viene
  confirmed?: boolean               // la volta è segnata come fatta nel calendario: pagata davvero, non solo impegnata
}

export type CheckKind =
  | 'missingDate' | 'missingAmount' | 'missingCategory' | 'unknownCategory'
  | 'missingFx' | 'recurringDuplicate'

export interface BucketRow {
  bucket: Bucket
  carriedOver: number
  fromIncome: number
  spent: number
  remaining: number
  available: number
}

/** Totali cumulati delle entrate divise: con la regola, e «a modo mio» per ogni combinazione di quote. */
export interface Divided { ruled: number; custom: Record<string, number> }

export interface MonthResult {
  ym: YearMonth
  period: { start: string; end: string }
  transactions: ClassifiedTx[]      // ricorrenti generati + movimenti del periodo, in ordine di data
  income: number
  spent: number
  saved: number
  leftOver: number
  paidFirst: number                 // spese "prima delle parti" del mese (quelle in arrivo contano già): si tolgono dalle entrate da dividere
  divided?: Divided                 // entrate divise dal primo mese fino a questo compreso (month.ts): ogni mese prende la differenza
  buckets: BucketRow[]
  byCategory: { category: Category; amount: number; share: number }[]
  checks: Record<CheckKind, number>
  spendingByBucket: Record<string, ClassifiedTx[]>
}
