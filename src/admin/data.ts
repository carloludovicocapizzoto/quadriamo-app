// Dati dell'area amministratore: tutto passa dalle funzioni admin_* del database, che rispondono solo
// a chi è nella tabella admins (il controllo è nel database, non qui).
import { db, keyHeaders } from './adminKey'
import { downloadFile } from '../ui/kit/download'
import { ENV } from '../env'

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
  v10: boolean | null         // script 0010 (budget comune) eseguito
  v11: boolean | null         // script 0011 (promemoria a sorpresa, slancio) eseguito
  v13: boolean | null         // script 0013 (abbonamenti Pro) eseguito
  v14: boolean | null         // script 0014 (notifiche delle notizie) eseguito
  news: boolean | null        // funzione news pubblicata
  billing: { fn: boolean; configured: boolean; webhook: boolean; test: boolean } | null   // funzione billing e chiavi Stripe
  adminKeys: boolean | null   // script 0006 (accesso con nome + codice) eseguito
  adminName: string | null    // nome di chi è entrato con il codice
  siteFeedback: boolean | null  // script 0005 (feedback dal sito) eseguito
  betaTools: boolean | null   // script 0024–0026 (diagnostica, uso dell'app, segnalazioni) eseguiti
  reportEmail: boolean | null // funzione report-email pubblicata e con i segreti di Resend (mail delle segnalazioni)
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

export const projectRef = () => ENV.supabase?.ref ?? ''

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
export const loadUsage = (days: number) => rpc<UsageStats>('admin_usage', { p_days: days })
export const loadReports = () => rpc<Report[]>('admin_reports', { p_limit: 300 })

/** Segnalazione di un tester (0026); email solo se aveva fatto l'accesso. */
export interface Report {
  id: string; created_at: string; kind: 'bug' | 'idea'; priority: 'low' | 'normal' | 'high' | 'blocking'; message: string
  attachments: string[]; env: string | null; version: string | null; status: 'new' | 'seen' | 'done'; email: string | null
  diagnostics: { os?: string; platform?: string; installed?: boolean; lang?: string; screen?: string; online?: boolean; release?: string; commit?: string
    env?: string; at?: string; timeZone?: string; route?: string; trail?: { s: number; kind: string; what: string }[] } | null
}

/** Allegati: link temporanei (un'ora) per vederli; dopo 90 giorni si cancellano (lo fa l'area amministratore quando si apre). */
export async function attachmentUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await db()!.storage.from('reports').createSignedUrls(paths, 3600)
  if (error) throw error
  return Object.fromEntries((data ?? []).flatMap(x => x.signedUrl && x.path ? [[x.path, x.signedUrl] as const] : []))
}
export const setReportStatus = async (id: string, status: Report['status']) => {
  const { error } = await db()!.from('tester_reports').update({ status }).eq('id', id); if (error) throw error
}
export async function deleteReport(r: Report) {
  if (r.attachments.length) await db()!.storage.from('reports').remove(r.attachments)
  const { error } = await db()!.from('tester_reports').delete().eq('id', r.id); if (error) throw error
}
/** Una mail di prova all'indirizzo delle segnalazioni (passo 19). */
export async function testReportEmail() {
  const { error } = await db()!.functions.invoke('report-email', { body: { mode: 'test' }, headers: keyHeaders() })
  if (error) throw error
}
export async function dropOldAttachments(rows: Report[], days = 90): Promise<number> {
  const old = rows.filter(r => r.attachments.length && Date.now() - Date.parse(r.created_at) > days * 864e5)
  for (const r of old) {
    await db()!.storage.from('reports').remove(r.attachments)
    await db()!.from('tester_reports').update({ attachments: [] }).eq('id', r.id)
  }
  return old.length
}

/** Come si usa l'app (0025): solo totali, solo voci usate da almeno `min` dispositivi. Sotto la soglia arrivano solo devices e min. */
export interface UsageStats {
  devices: number; min: number
  sessions?: number; median_seconds?: number | null; slow_share?: number | null; error_share?: number | null
  daily?: { day: string; sessions: number }[]
  screens?: { screen: string; devices: number; sessions: number; avg_seconds: number }[]
  exits?: { screen: string; sessions: number }[]
  paths?: { from: string; to: string; times: number }[]
  actions?: { action: string; devices: number; times: number }[]
}

// PGRST202 = funzione inesistente: lo script che la crea non è ancora stato eseguito
type Res = { error: { code?: string; message: string } | null }
const exists = (r: Res) => !(r.error && (r.error.code === 'PGRST202' || /could not find the function/i.test(r.error.message)))
const NONE = '00000000-0000-0000-0000-000000000000'

export async function checkSetup(signedIn: boolean): Promise<Setup> {
  const supabase = db()
  const s: Setup = { connected: !!supabase, tables: null, profiles: null, research: null, v8: null, v10: null, v11: null, v13: null, v14: null, billing: null, news: null, siteFeedback: null, adminKeys: null, adminName: null, betaTools: null, reportEmail: null, admin: false, fn: 'unknown', cronSecret: false, reminder: false,
    vapidInApp: !!ENV.vapidKey }
  if (!supabase || !signedIn) return s
  // i controlli partono tutti insieme; quelli con un indirizzo finto ("check://") non toccano niente
  const key = ENV.supabase?.key ?? ''
  const [ad, pr, rs, co, sh, tp, sn, bs, bf, news, an, sf, rp, re] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.from('profiles').select('user_id', { head: true, count: 'exact' }),
    supabase.rpc('admin_research_stats'),
    supabase.rpc('admin_cohorts', { p_weeks: 1 }),
    supabase.rpc('is_shared_member', { p_budget: NONE }),
    supabase.rpc('touch_push', { p_endpoint: 'check://quadriamo-admin', p_day: '2000-01-01' }),
    supabase.rpc('set_news_push', { p_endpoint: 'check://quadriamo-admin', p_on: true }),
    supabase.rpc('admin_billing_stats'),
    supabase.functions.invoke('billing', { body: { action: 'status' } }),
    // le notizie si chiamano come dall'app (senza il codice da amministratore, che la funzione non si aspetta)
    fetch(`${ENV.supabase?.url}/functions/v1/news`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: 'it' }) })
      .then(async r => r.ok && Array.isArray((await r.json())?.items), () => false),
    supabase.rpc('admin_name'),
    supabase.rpc('site_feedback_ready'),
    supabase.rpc('admin_reports', { p_limit: 1 }),
    supabase.functions.invoke('report-email', { body: { mode: 'check' } }),
  ])
  s.tables = exists(ad); s.admin = ad.data === true
  s.profiles = !(pr.error && (pr.error.code === 'PGRST205' || pr.error.code === '42P01'))
  s.research = exists(rs); s.v8 = exists(co); s.v10 = exists(sh); s.v11 = exists(tp); s.v14 = exists(sn); s.v13 = exists(bs)
  s.billing = bf.error ? { fn: false, configured: false, webhook: false, test: false }
    : { fn: true, configured: !!bf.data?.configured, webhook: !!bf.data?.webhook, test: !!bf.data?.test }
  s.news = news
  s.adminKeys = exists(an); s.adminName = (an.data as string | null) ?? null
  s.siteFeedback = !sf.error
  s.betaTools = exists(rp)
  s.reportEmail = !re.error && re.data?.configured === true
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
  downloadFile(name, 'csv', csv, 'text/csv;charset=utf-8')
}
