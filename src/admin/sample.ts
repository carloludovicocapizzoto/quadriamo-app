// Dati finti per vedere l'area amministratore prima della configurazione (/admin/?demo=1): nessun dato reale.
import type { Account, Device, Feedback, PushSub, ResearchStats, Setup, Stats } from './data'

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const at = (n: number, h = 10) => `${day(n)}T${String(h).padStart(2, '0')}:15:00Z`
const wave = (i: number) => Math.round(6 + i * 0.9 + 4 * Math.sin(i / 2))

export function sampleStats(days: number): Stats {
  const daily = Array.from({ length: days }, (_, k) => { const i = days - 1 - k; const a = Math.max(1, wave(days - i)); return { day: day(i), active: a, new: Math.max(0, Math.round(a / 4 - (i % 3))) } })
  return { devices: 64, active_1: daily.at(-1)!.active, active_7: 38, active_30: 57, accounts: 21, installed: 29, signed_in: 18, with_tx: 47, activated: 31,
    avg_tx: 23.4, push: 26, feedback_count: 17, feedback_avg: 4.2, retention_7: 61.5, retention_30: 42.9, daily,
    langs: { it: 41, en: 12, es: 6, fr: 5 }, platforms: { ios: 33, android: 19, desktop: 12 },
    events: { open: 486, import: 23, share: 14, feedback: 17, install: 29, push_on: 26 } }
}
const plat = ['ios', 'android', 'desktop'], langs = ['it', 'it', 'it', 'en', 'es', 'fr']
export const sampleDevices: Device[] = Array.from({ length: 24 }, (_, i) => ({
  device_id: `${(0x3a7f12c0 + i * 7919).toString(16)}-0000-4000-8000-000000000000`, first_day: day(30 - i), last_day: day(i % 5), active_days: 20 - (i % 15),
  platform: plat[i % 3], lang: langs[i % 6], standalone: i % 2 === 0, signed_in: i % 3 === 0, tx_count: (i * 7) % 60, months_used: 1 + (i % 2), app_version: '0.9-beta' }))
const names = ['giulia.r', 'marco.b', 'sara.l', 'luca.m', 'elena.c', 'paolo.v', 'chiara.d', 'andrea.f']
const people = [['Giulia', 'Rossi'], ['Marco', 'Bianchi'], ['Sara', 'Leone'], ['Luca', 'Moretti'], ['Elena', 'Conti'], ['Paolo', 'Villa'], ['Chiara', 'De Luca'], ['Andrea', 'Ferri']]
export const sampleAccounts: Account[] = names.map((n, i) => ({ email: `${n}@esempio.it`, first_name: people[i][0], last_name: people[i][1], created_at: at(28 - i * 3), last_sign_in_at: at(i, 18), has_push: i % 2 === 0, feedback_count: i % 3 }))
const msgs = ['Finalmente capisco dove finiscono i soldi a fine mese.', 'Mi piacerebbe collegare la carta in automatico.', null,
  'L’import del CSV della banca è comodissimo.', 'Un po’ difficile all’inizio, poi chiarissima.', 'Vorrei un grafico per categoria.', null, 'Top!']
export const sampleFeedback: Feedback[] = msgs.map((m, i) => ({ id: i + 1, created_at: at(i * 2, 9 + i), rating: [5, 4, 4, 5, 3, 4, 5, 5][i], message: m,
  lang: langs[i % 6], app_version: i % 3 === 2 ? 'site' : '0.9-beta', user_id: i % 2 ? 'x' : null,
  source: i % 3 === 2 ? 'site' as const : 'app' as const, email: i === 2 ? 'lettore@esempio.it' : null }))
export const samplePush: PushSub[] = Array.from({ length: 6 }, (_, i) => ({ lang: langs[i], created_at: at(25 - i * 3), last_prompt_at: i < 4 ? at(3, 18) : null,
  email: i % 2 ? sampleAccounts[i].email : null }))
export const sampleResearch: ResearchStats = { answers: 14, min: 5,
  income_bands: { lt1000: 2, '1000-1500': 3, '1500-2000': 5, '2000-3000': 3, ge3000: 1 },
  goals: { understand: 10, save: 8, goal: 5, invest: 5, debt: 2, family: 3 }, cards: { bank: 11, Revolut: 6, Satispay: 5, PayPal: 4, credit: 3 },
  invested: { yes: 5, want: 7, no: 2 }, invest_where: { etf: 4, broker: 3, bank: 2, crypto: 1 },
  shares_avg: [53.6, 21.4, 14.6, 10.4], shares_default: 9, shares_custom: 5 }
export const sampleSetup: Setup = { connected: true, tables: true, profiles: true, research: true, siteFeedback: true, adminKeys: true, adminName: null, admin: true, fn: 'ok', cronSecret: true, reminder: true, vapidInApp: true }
