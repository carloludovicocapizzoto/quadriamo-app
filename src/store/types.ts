// I dati dell'app (quello che si salva e si sincronizza), le azioni che li cambiano e lo stato del negozio.
import type { Goal, Investments, Rule, Settings, Transaction } from '../engine'

export interface AppData {
  version: 1
  settings: Settings
  transactions: Transaction[]
  demo?: boolean                      // dati di esempio: l'app propone di ripartire da zero, non si sincronizzano
  settingsUpdatedAt?: string          // ISO, ultima modifica delle impostazioni
  deleted?: Record<string, string>    // id movimento eliminato -> quando (per non farlo "risorgere" da un altro dispositivo)
  investments?: Investments
  investmentsUpdatedAt?: string
  inbox?: InboxItem[]                 // transazioni importate da confermare
  importDone?: Record<string, string> // impronta -> quando è stata confermata o ignorata (niente doppioni)
  payday?: Record<string, string[]>   // "YYYY-MM" -> bucket già trasferiti nel piano del giorno di paga
  profile?: PrivateProfile            // risposte facoltative del profilo: restano nei dati dell'utente, mai all'amministratore
  profileUpdatedAt?: string
  activity?: string[]                 // giorni (locali) in cui l'utente ha aggiornato Quadriamo: servono allo "slancio"
  goals?: Goal[]                      // obiettivi di risparmio (gli eliminati restano con removed: true per la sincronizzazione)
}

/** Entrate, obiettivi, carte, investimenti: dati sensibili, riservati all'utente (vedi sync/research per la ricerca anonima). */
export interface PrivateProfile {
  monthlyIncome: number | null
  goals: string[]
  cards: string[]
  invested: 'yes' | 'no' | 'want' | null
  investWhere: string[]
  research: boolean                   // ha scelto di partecipare alla ricerca anonima
  country?: string | null             // paese di provenienza (ISO, es. "IT"): resta nei dati dell'utente, mai alla ricerca
  residence?: string | null           // paese in cui vive, se diverso
}

/** Transazione importata (estratto conto o, in futuro, carta collegata) in attesa di conferma. */
export interface InboxItem {
  id: string
  fingerprint: string
  date: string
  description: string
  amount: number            // con segno: negativo = uscita
  currency: string | null
  category: string | null   // proposta (modificabile)
  paidFrom: string | null
  source: string            // es. "csv"
}

export type Action =
  | { type: 'load'; data: AppData | null }
  | { type: 'addTx'; tx: Transaction; at?: string }
  | { type: 'updateTx'; tx: Transaction; at?: string }
  | { type: 'deleteTx'; id: string; at?: string }
  | { type: 'setSettings'; settings: Settings; at?: string }
  | { type: 'deleteCategory'; id: string; moveTo: string | null; at?: string }   // sposta movimenti, scadenze e regole, poi elimina
  | { type: 'setFx'; currency: string; rates: Record<string, number>; date: string }   // cambi automatici: non sono una modifica dell'utente
  | { type: 'setInvestments'; investments: Investments; at?: string }
  | { type: 'addInbox'; items: InboxItem[] }
  | { type: 'updateInbox'; item: InboxItem }
  | { type: 'confirmInbox'; ids: string[]; txs: Transaction[]; rule?: Rule; at?: string }
  | { type: 'ignoreInbox'; ids: string[]; at?: string }
  | { type: 'togglePayday'; month: string; bucketId: string }
  | { type: 'setProfile'; profile: PrivateProfile | null; at?: string }
  | { type: 'saveGoal'; goal: Goal; at?: string }
  | { type: 'deleteGoal'; id: string; at?: string }
  | { type: 'goalMoney'; id: string; amount: number; date: string; at?: string }   // versamento (o prelievo se negativo)
  | { type: 'replace'; data: AppData | null }

export interface State { loaded: boolean; data: AppData | null }
