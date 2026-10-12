// Dati dell'area amministratore: tutto passa dalle funzioni admin_* del database, che rispondono solo
// a chi è nella tabella admins (il controllo è nel database, non qui).
import { db, keyHeaders } from './adminKey'

export interface Stats {
  devices: number; active_1: number; active_7: number; active_30: number; accounts: number; installed: number
  signed_in: number; with_tx: number; activated: number; avg_tx: number; push: number
  feedback_count: number; feedback_avg: number | null; retention_7: number | null; retention_30: number | null
  daily: { day: string; active: number; new: number }[] | null
  langs: Record<string, number>; platforms: Record<string, number>; events: Record<string, number>
}
export interface Feedback { id: number; created_at: string; rating: number | null; message: string | null; lang: string | null; app_version: string | null; user_id: string | null; email?: string | null; source?: 'app' | 'site'; alternative?: string | null; alternative_other?: string | null }
export interface Cohort { week: string; new_devices: number; back_7: number; ready: boolean }
export interface Device {
  device_id: string; first_day: string; last_day: string; active_days: number; platform: string | null; lang: string | null
  standalone: boolean | null; signed_in: boolean | null; tx_count: number | null; months_used: number | null; app_version: string | null
}
export interface Account { email: string; first_name: string | null; last_name: string | null; created_at: string; last_sign_in_at: string | null; has_push: boolean; feedback_count: number }
/** Ricerca anonima: totali delle schede inviate per scelta degli utenti; sotto `min` schede arriva solo il conteggio. */
export interface ResearchStats {
  answers: number; min: number
  income_bands?: Record<string, number>; goals?: Record<string, number>; cards?: Record<string, number>
  invested?: Record<string, number>; invest_where?: Record<string, number>
  shares_avg?: number[] | null; shares_default?: number; shares_custom?: number
}
export interface PushSub { lang: string | null; created_at: string; last_prompt_at: string | null; email: string | null }

/** Stato della configurazione su Supabase, controllato dal vivo (pagina Configurazione). */
export interface Setup {
  connected: boolean          // l'app ha URL e chiave di Supabase
  tables: boolean | null      // script 0002 eseguito (null = non ancora verificabile: serve l'accesso)
  profiles: boolean | null    // script 0004 (profili) eseguito
  research: boolean | null    // script 0007 (profilo riservato e ricerca anonima) eseguito
  v8: boolean | null          // script 0008 (notifica del mattino, alternative, coorti) eseguito
  adminKeys: boolean | null   // script 0006 (accesso con nome + codice) eseguito
  adminName: string | null    // nome di chi è entrato con il codice
  siteFeedback: boolean | null  // script 0005 (feedback dal sito) eseguito
  admin: boolean              // questo account è amministratore
  fn: 'ok' | 'missing' | 'nosecrets' | 'unknown'   // funzione send-push pubblicata e con le chiavi
  cronSecret: boolean
  reminder: boolean           // promemoria automatico ogni 10 giorni attivo
  vapidInApp: boolean         // chiave pubblica delle notifiche presente nell'app
}

export const LABELS: Record<string, string> = {
  open: 'Aperture', install: 'Installazioni', import: 'Import estratti conto', share: 'Inviti inviati',
  feedback: 'Feedback inviati', push_on: 'Notifiche attivate', it: 'Italiano', en: 'Inglese', fr: 'Francese', es: 'Spagnolo',
  understand: 'Capire dove vanno i soldi', save: 'Risparmiare di più', goal: 'Mettere da parte per un obiettivo', debt: 'Ridurre debiti o rate',
  invest: 'Iniziare a investire', family: 'Spese di casa o di coppia', bank: 'Banca', credit: 'Carta di credito', prepaid: 'Carta prepagata',
  cash: 'Soprattutto contanti', other: 'Altro', yes: 'Sì, investe', want: 'No, ma vorrebbe', no: 'No', broker: 'App o broker online', etf: 'ETF',
  stocks: 'Azioni', bonds: 'Titoli di Stato e obbligazioni', pension: 'Fondo pensione', crypto: 'Criptovalute', realestate: 'Immobili',
  lt1000: 'meno di 1.000 €', '1000-1500': '1.000–1.500 €', '1500-2000': '1.500–2.000 €', '2000-3000': '2.000–3.000 €', ge3000: '3.000 € e oltre',
  nothing: 'Niente, non terrebbe i conti', spreadsheet: 'Excel o un foglio', notes: 'Note o carta', bank_app: 'L’app della banca', other_app: 'Un’altra app',
  ios: 'iPhone / iPad', android: 'Android', desktop: 'Computer', '?': 'Non indicato',
}
export const label = (k: string | null | undefined) => LABELS[k ?? '?'] ?? k ?? '—'

export const projectRef = () => (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.match(/https:\/\/([^.]+)\./)?.[1] ?? ''

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db()!.rpc(name, args)
  if (error) throw error
  return data as T
}
export const loadStats = (days: number) => rpc<Stats>('admin_stats', { p_days: days })
export const loadFeedback = () => rpc<Feedback[]>('admin_feedback', { p_limit: 500 })
export const loadDevices = () => rpc<Device[]>('admin_devices', { p_limit: 5000 })
export const loadAccounts = () => rpc<Account[]>('admin_accounts')
export const loadResearch = () => rpc<ResearchStats>('admin_research_stats')
export const loadCohorts = () => rpc<Cohort[]>('admin_cohorts', { p_weeks: 8 })
export const loadAlternatives = () => rpc<Record<string, number>>('admin_alternatives')
export const loadPush = () => rpc<PushSub[]>('admin_push_list')

export async function checkSetup(signedIn: boolean): Promise<Setup> {
  const supabase = db()
  const s: Setup = { connected: !!supabase, tables: null, profiles: null, research: null, v8: null, siteFeedback: null, adminKeys: null, adminName: null, admin: false, fn: 'unknown', cronSecret: false, reminder: false,
    vapidInApp: !!import.meta.env.VITE_VAPID_PUBLIC_KEY }
  if (!supabase || !signedIn) return s
  const { data, error } = await supabase.rpc('is_admin')
  // PGRST202 = funzione inesistente: lo script 0002 non è ancora stato eseguito
  s.tables = !(error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message)))
  s.admin = data === true
  const pr = await supabase.from('profiles').select('user_id', { head: true, count: 'exact' })
  s.profiles = !(pr.error && (pr.error.code === 'PGRST205' || pr.error.code === '42P01'))
  const rs = await supabase.rpc('admin_research_stats')
  s.research = !(rs.error && (rs.error.code === 'PGRST202' || /could not find the function/i.test(rs.error.message)))
  const co = await supabase.rpc('admin_cohorts', { p_weeks: 1 })
  s.v8 = !(co.error && (co.error.code === 'PGRST202' || /could not find the function/i.test(co.error.message)))
  const an = await supabase.rpc('admin_name')
  s.adminKeys = !(an.error && (an.error.code === 'PGRST202' || /could not find the function/i.test(an.error.message)))
  s.adminName = (an.data as string | null) ?? null
  const sf = await supabase.rpc('site_feedback_ready')
  s.siteFeedback = !sf.error
  if (!s.admin) return s
  const fn = await supabase.functions.invoke('send-push', { body: { mode: 'check' }, headers: keyHeaders() })
  if (fn.error) s.fn = 'missing'
  else { s.fn = fn.data?.vapid ? 'ok' : 'nosecrets'; s.cronSecret = !!fn.data?.cron }
  s.reminder = await rpc<boolean>('admin_reminder_active').catch(() => false)
  return s
}

export async function sendPush(title: string, body: string) {
  const { data, error } = await db()!.functions.invoke('send-push', { body: { mode: 'manual', title: title || undefined, body: body || undefined }, headers: keyHeaders() })
  if (error) throw error
  return data as { total: number; sent: number; removed: number; failed: number }
}

/** Scarica una tabella come CSV (si apre in Excel: separatore ";" e BOM per gli accenti). */
export function downloadCsv(name: string, rows: (string | number | boolean | null | undefined)[][]) {
  const cell = (v: unknown) => { const t = v == null ? '' : String(v); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
  const csv = '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(a.href)
}
