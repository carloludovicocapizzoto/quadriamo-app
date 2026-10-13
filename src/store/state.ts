// Stato dell'app e sue modifiche: funzioni pure, testate in state.test.ts.
import { FIRST, OLD_STUDENT_SHARES, STUDENT_SHARES, compareYm, mergeGoals, withDay, type Goal, daysBetween, defaultSettings, monthOf, normalize, seedRules, suggest, type ImportRow, type Investments, type Rule, type Settings, type Transaction, type YearMonth } from '../engine'

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

export const fingerprintOf = (r: { date: string; amount: number; description: string }) =>
  `${r.date}|${r.amount.toFixed(2)}|${normalize(r.description)}`

/** Prepara l'import: scarta le righe già viste (in casella, confermate o ignorate) e propone categoria e bucket. */
export function planImport(d: AppData, rows: ImportRow[], source = 'csv'): { items: InboxItem[]; duplicates: number } {
  const seen = new Set([...(d.inbox ?? []).map(i => i.fingerprint), ...Object.keys(d.importDone ?? {})])
  const items: InboxItem[] = []
  let duplicates = 0
  for (const r of rows) {
    const fp = fingerprintOf(r)
    if (seen.has(fp)) { duplicates++; continue }
    seen.add(fp)
    const sug = suggest(r.description, r.amount, d.settings)
    items.push({ id: newId(), fingerprint: fp, date: r.date, description: r.description, amount: r.amount,
                 currency: r.currency && r.currency !== d.settings.currency ? r.currency : null,
                 category: sug.category, paidFrom: sug.paidFrom, source })
  }
  return { items, duplicates }
}

/**
 * Righe importate che forse sono già tra i movimenti (es. inserite a mano): stesso importo, stessa direzione,
 * stessa valuta, data entro ±3 giorni (le carte contabilizzano spesso dopo). Ogni movimento copre al massimo una riga.
 */
export function duplicateCandidates(d: AppData, maxDays = 3): Map<string, Transaction> {
  const out = new Map<string, Transaction>()
  const used = new Set<string>()
  const base = d.settings.currency
  const isIncome = (t: Transaction) => d.settings.categories.find(c => c.id === t.category)?.type === 'income'
  const items = [...(d.inbox ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  for (const i of items) {
    let best: Transaction | null = null, bestGap = Infinity
    for (const t of d.transactions) {
      if (used.has(t.id) || t.amount == null || !t.date) continue
      if (Math.abs(t.amount - Math.abs(i.amount)) > 0.005) continue
      if ((t.currency || base) !== (i.currency || base)) continue
      if (t.category && isIncome(t) !== i.amount > 0) continue
      const gap = Math.abs(daysBetween(t.date, i.date))
      if (gap <= maxDays && gap < bestGap) { best = t; bestGap = gap }
    }
    if (best) { out.set(i.id, best); used.add(best.id) }
  }
  return out
}

export type Action =
  | { type: 'load'; data: AppData | null }
  | { type: 'addTx'; tx: Transaction; at?: string }
  | { type: 'updateTx'; tx: Transaction; at?: string }
  | { type: 'deleteTx'; id: string; at?: string }
  | { type: 'setSettings'; settings: Settings; at?: string }
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

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Se un movimento è più vecchio del primo mese tracciato, il primo mese si sposta indietro. */
function widenFirstMonth(s: Settings, tx: Transaction): Settings {
  if (!tx.date) return s
  const ym = monthOf(tx.date, s.monthStartDay)
  return compareYm(ym, s.firstMonth) < 0 ? { ...s, firstMonth: ym } : s
}

/** Come si chiama l'affitto nelle quattro lingue (pagamenti ricorrenti e regole creati prima della categoria "Affitto"). */
const RENT_NAMES = ['affitto', 'rent', 'alquiler', 'loyer']

/**
 * Aggiorna dati salvati con versioni precedenti dell'app. Ogni passo si applica una volta sola
 * (`settings.schema`): una categoria aggiunta qui e poi cancellata dall'utente non torna.
 */
export function migrate(d: AppData | null): AppData | null {
  if (!d) return d
  let s = d.settings
  if (!s.rules) s = { ...s, rules: seedRules() }
  if ((s.schema ?? 0) < 2) {
    // 2: categoria "Rate e finanziamenti", subito dopo i costi fissi
    const categories = [...s.categories]
    if (!categories.some(c => c.id === 'loans')) {
      const bucket = s.buckets.find(b => b.id === 'essentials')?.id ?? s.buckets[0]?.id ?? null
      const at = categories.findIndex(c => c.id === 'fixedCosts')
      categories.splice(at + 1, 0, { id: 'loans', name: 'loans', type: 'expense', defaultBucket: bucket })
    }
    s = { ...s, categories, schema: 2 }
  }
  if ((s.schema ?? 0) < 3) {
    // 3: l'affitto ha una categoria sua, pagata prima di dividere le entrate nelle quattro parti
    const categories = [...s.categories]
    if (!categories.some(c => c.id === 'rent')) {
      const at = Math.max(0, categories.findIndex(c => c.id === 'fixedCosts'))
      categories.splice(at, 0, { id: 'rent', name: 'rent', type: 'expense', defaultBucket: FIRST })
    }
    const isRent = (name: string) => RENT_NAMES.includes(name.trim().toLowerCase())
    const recurring = s.recurring.map(r => r.category === 'fixedCosts' && isRent(r.name) ? { ...r, category: 'rent' } : r)
    const rules = s.rules?.map(r => r.category === 'fixedCosts' && isRent(r.keyword) ? { ...r, category: 'rent' } : r)
    // lo studente con la regola di partenza: con l'affitto fuori, gli Essenziali non hanno più bisogno del 60%
    const oldRule = s.persona === 'student' && s.buckets.every(b => Math.abs(b.share - (OLD_STUDENT_SHARES[b.id] ?? -1)) < 1e-9)
    const buckets = oldRule ? s.buckets.map(b => ({ ...b, share: STUDENT_SHARES[b.id] ?? b.share })) : s.buckets
    s = { ...s, categories, recurring, rules, buckets, schema: 3 }
  }
  return s === d.settings ? d : { ...d, settings: s }
}

/** Giorno locale (YYYY-MM-DD) di un istante. */
function localDay(at: string): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Le azioni con cui l'utente aggiorna la sua situazione contano per lo slancio. */
const ACTIVE: Action['type'][] = ['addTx', 'updateTx', 'deleteTx', 'confirmInbox', 'goalMoney']

export function reducer(state: State, a: Action): State {
  const next = reduce(state, a)
  if (!ACTIVE.includes(a.type) || !next.data || next.data === state.data || next.data.demo) return next
  const day = localDay(('at' in a && a.at) || new Date().toISOString())
  return { ...next, data: { ...next.data, activity: withDay(next.data.activity, day) } }
}

function reduce(state: State, a: Action): State {
  if (a.type === 'load') return { loaded: true, data: migrate(a.data) }
  if (a.type === 'replace') return { ...state, data: migrate(a.data) }
  const d = state.data
  if (!d) return state
  const at = ('at' in a && a.at) || new Date().toISOString()
  switch (a.type) {
    case 'addTx': {
      const tx = { ...a.tx, updatedAt: at }
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, tx), transactions: [...d.transactions, tx] } }
    }
    case 'updateTx': {
      const tx = { ...a.tx, updatedAt: at }
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, tx),
                                 transactions: d.transactions.map(t => t.id === tx.id ? tx : t) } }
    }
    case 'deleteTx':
      return { ...state, data: { ...d, transactions: d.transactions.filter(t => t.id !== a.id),
                                 deleted: { ...d.deleted, [a.id]: at } } }
    case 'setSettings':
      return { ...state, data: { ...d, settings: a.settings, settingsUpdatedAt: at } }
    case 'saveGoal': {
      const g = { ...a.goal, updatedAt: at }
      const goals = (d.goals ?? []).some(x => x.id === g.id) ? (d.goals ?? []).map(x => x.id === g.id ? g : x) : [...(d.goals ?? []), g]
      return { ...state, data: { ...d, goals } }
    }
    case 'deleteGoal':
      return { ...state, data: { ...d, goals: (d.goals ?? []).map(x => x.id === a.id ? { ...x, removed: true, contributions: [], updatedAt: at } : x) } }
    case 'goalMoney':
      return { ...state, data: { ...d, goals: (d.goals ?? []).map(x => x.id === a.id
        ? { ...x, contributions: [...x.contributions, { id: newId(), date: a.date, amount: Math.round(a.amount * 100) / 100 }], updatedAt: at } : x) } }
    case 'setProfile':
      return { ...state, data: { ...d, profile: a.profile ?? undefined, profileUpdatedAt: at } }
    case 'setInvestments':
      return { ...state, data: { ...d, investments: a.investments, investmentsUpdatedAt: at } }
    case 'addInbox':
      return { ...state, data: { ...d, inbox: [...(d.inbox ?? []), ...a.items] } }
    case 'updateInbox':
      return { ...state, data: { ...d, inbox: (d.inbox ?? []).map(i => i.id === a.item.id ? a.item : i) } }
    case 'confirmInbox':
    case 'ignoreInbox': {
      const done = { ...d.importDone }
      for (const i of d.inbox ?? []) if (a.ids.includes(i.id)) done[i.fingerprint] = at
      let settings = d.settings, settingsUpdatedAt = d.settingsUpdatedAt
      let transactions = d.transactions
      if (a.type === 'confirmInbox') {
        const txs = a.txs.map(tx => ({ ...tx, updatedAt: at }))
        transactions = [...transactions, ...txs]
        for (const tx of txs) settings = widenFirstMonth(settings, tx)
        if (a.rule) { settings = { ...settings, rules: [...(settings.rules ?? seedRules()), a.rule] }; settingsUpdatedAt = at }
      }
      return { ...state, data: { ...d, settings, settingsUpdatedAt, transactions, importDone: done,
                                 inbox: (d.inbox ?? []).filter(i => !a.ids.includes(i.id)) } }
    }
    case 'togglePayday': {
      const cur = d.payday?.[a.month] ?? []
      const next = cur.includes(a.bucketId) ? cur.filter(b => b !== a.bucketId) : [...cur, a.bucketId]
      return { ...state, data: { ...d, payday: { ...d.payday, [a.month]: next } } }
    }
  }
}

export function createInitial(currency: string, today: string, monthStartDay = 1): AppData {
  const firstMonth: YearMonth = monthOf(today, monthStartDay)
  const settings = defaultSettings({ currency, firstMonth })
  settings.monthStartDay = monthStartDay
  return { version: 1, settings, transactions: [] }
}

export type SettingsError = 'sharesNot100' | 'bucketName' | 'startDay' | 'categoryName' | 'recurring'

export function validateSettings(s: Settings): SettingsError[] {
  const out: SettingsError[] = []
  const total = s.buckets.reduce((a, b) => a + b.share, 0)
  if (Math.abs(total - 1) > 0.0001) out.push('sharesNot100')
  if (s.buckets.some(b => !b.name.trim())) out.push('bucketName')
  if (!Number.isInteger(s.monthStartDay) || s.monthStartDay < 1 || s.monthStartDay > 28) out.push('startDay')
  if (s.categories.some(c => !c.name.trim())) out.push('categoryName')
  if (s.recurring.some(r => !r.name.trim() || !(r.amount > 0) || !s.categories.some(c => c.id === r.category) ||
                            (r.day != null && (r.day < 1 || r.day > 31)))) out.push('recurring')
  return out
}

/** Legge un backup JSON; lancia un errore se non è un backup valido di Quadriamo. */
export function parseBackup(text: string): AppData {
  const d = JSON.parse(text)
  const ok = d && d.version === 1 && d.settings && Array.isArray(d.settings.buckets) && d.settings.buckets.length === 4 &&
    Array.isArray(d.settings.categories) && Array.isArray(d.settings.recurring) && Array.isArray(d.transactions) &&
    typeof d.settings.currency === 'string' && d.settings.firstMonth &&
    d.transactions.every((t: Transaction) => typeof t.id === 'string' && typeof t.description === 'string')
  if (!ok) throw new Error('invalid backup')
  return { version: 1, settings: { fxRates: {}, ...d.settings }, transactions: d.transactions,
           deleted: d.deleted ?? {}, settingsUpdatedAt: d.settingsUpdatedAt,
           ...(d.investments ? { investments: d.investments, investmentsUpdatedAt: d.investmentsUpdatedAt } : {}),
           inbox: d.inbox ?? [], importDone: d.importDone ?? {}, payday: d.payday ?? {},
           ...(d.profile ? { profile: d.profile, profileUpdatedAt: d.profileUpdatedAt } : {}),
           ...(Array.isArray(d.activity) ? { activity: d.activity } : {}),
           ...(Array.isArray(d.goals) ? { goals: d.goals } : {}) }
}

/** Parse di un importo scritto dall'utente: accetta "12,50", "12.50", "1.234,56", "1,234.56". */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s€$£¥]/g, '').replace(/[^\d.,-]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    const dec = lastComma > lastDot ? ',' : '.'
    s = s.split(dec === ',' ? '.' : ',').join('').replace(dec, '.')
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/**
 * Unisce i dati di due dispositivi: per ogni movimento vince la modifica più recente,
 * le eliminazioni più recenti della modifica vincono, per le impostazioni vince la versione più recente.
 */
export function mergeData(a: AppData, b: AppData): AppData {
  const deleted: Record<string, string> = { ...a.deleted }
  for (const [id, at] of Object.entries(b.deleted ?? {})) if (!deleted[id] || at > deleted[id]) deleted[id] = at

  const byId = new Map<string, Transaction>()
  for (const tx of [...a.transactions, ...b.transactions]) {
    const prev = byId.get(tx.id)
    if (!prev || (tx.updatedAt ?? '') > (prev.updatedAt ?? '')) byId.set(tx.id, tx)
  }
  const transactions = [...byId.values()].filter(tx => !(deleted[tx.id] && deleted[tx.id] >= (tx.updatedAt ?? '')))

  const newerSettings = (b.settingsUpdatedAt ?? '') > (a.settingsUpdatedAt ?? '')
  let settings = newerSettings ? b.settings : a.settings
  for (const tx of transactions) settings = widenFirstMonth(settings, tx)

  const importDone: Record<string, string> = { ...a.importDone }
  for (const [fp, at] of Object.entries(b.importDone ?? {})) if (!importDone[fp] || at > importDone[fp]) importDone[fp] = at
  const inboxById = new Map<string, InboxItem>()
  for (const i of [...(a.inbox ?? []), ...(b.inbox ?? [])]) if (!importDone[i.fingerprint]) inboxById.set(i.id, i)
  const inboxFp = new Set<string>()
  const inbox = [...inboxById.values()].filter(i => !inboxFp.has(i.fingerprint) && inboxFp.add(i.fingerprint))
  const payday: Record<string, string[]> = { ...b.payday, ...a.payday }
  const newerInv = (b.investmentsUpdatedAt ?? '') > (a.investmentsUpdatedAt ?? '')
  const investments = newerInv ? b.investments : (a.investments ?? b.investments)
  const activity = [...new Set([...(a.activity ?? []), ...(b.activity ?? [])])].sort().slice(-400)
  const newerProfile = (b.profileUpdatedAt ?? '') > (a.profileUpdatedAt ?? '')
  const profile = newerProfile ? b.profile : (a.profileUpdatedAt ? a.profile : (a.profile ?? b.profile))
  return {
    version: 1, settings, transactions, deleted,
    settingsUpdatedAt: newerSettings ? b.settingsUpdatedAt : a.settingsUpdatedAt,
    ...(investments ? { investments, investmentsUpdatedAt: newerInv ? b.investmentsUpdatedAt : a.investmentsUpdatedAt } : {}),
    inbox, importDone, payday,
    ...(activity.length ? { activity } : {}),
    ...(a.goals || b.goals ? { goals: mergeGoals(a.goals, b.goals) } : {}),
    ...(profile || a.profileUpdatedAt || b.profileUpdatedAt
      ? { profile, profileUpdatedAt: newerProfile ? b.profileUpdatedAt : a.profileUpdatedAt } : {}),
  }
}

/** Esporta i movimenti in CSV (separatore ";" e virgola decimale non servono: Excel/Sheets leggono il punto se indicato). */
export function toCsv(d: AppData, names: { category: (id: string | null) => string; bucket: (id: string | null) => string }): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [['date', 'description', 'category', 'amount', 'currency', 'paid_from'].join(',')]
  const sorted = [...d.transactions].sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''))
  for (const t of sorted) {
    rows.push([t.date, t.description, names.category(t.category), t.amount, t.currency || d.settings.currency,
               t.paidFrom ? names.bucket(t.paidFrom) : ''].map(esc).join(','))
  }
  return rows.join('\n') + '\n'
}
