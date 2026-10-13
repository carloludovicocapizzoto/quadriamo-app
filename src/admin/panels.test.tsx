import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Setup, Stats } from './data'
import { AccountsPanel, DashboardPanel, DevicesPanel, FeedbackPanel, PushPanel, ResearchPanel, SetupPanel } from './panels'
import { sampleResearch } from './sample'

// stessi numeri restituiti da admin_stats() nella prova con PGlite
const stats: Stats = {
  devices: 4, active_1: 2, active_7: 3, active_30: 4, accounts: 2, installed: 1, signed_in: 1, with_tx: 2, activated: 1, avg_tx: 8.7,
  push: 1, feedback_count: 1, feedback_avg: 4, retention_7: 50, retention_30: 100,
  daily: [{ day: '2026-10-09', active: 1, new: 0 }, { day: '2026-10-10', active: 2, new: 2 }],
  langs: { it: 2, en: 1, '?': 1 }, platforms: { ios: 1, android: 1, desktop: 1 }, events: { open: 4, share: 1 },
}
const setup: Setup = { connected: true, tables: true, profiles: true, research: true, v8: true, v10: true, v11: true, v13: true, v14: true, billing: { fn: true, configured: true, webhook: true, test: true }, news: true, siteFeedback: true, adminKeys: true, adminName: null, admin: true, fn: 'ok', cronSecret: true, reminder: false, vapidInApp: true }

describe('area amministratore', () => {
  it('dashboard: numeri chiave, imbuto, lingue', () => {
    const h = renderToString(<DashboardPanel stats={stats} days={30} setDays={() => {}} />)
    for (const s of ['Dispositivi totali', 'Tornano dopo 7 giorni', '50%', 'Attivati (6+ movimenti', 'Italiano', 'iPhone / iPad', 'Inviti inviati', 'voto medio 4/5'])
      expect(h).toContain(s)
  })
  it('dashboard con database vuoto', () => {
    const empty: Stats = { ...stats, devices: 0, active_1: 0, active_7: 0, active_30: 0, with_tx: 0, activated: 0, push: 0, feedback_count: 0,
      feedback_avg: null, retention_7: null, retention_30: null, daily: null, langs: {}, platforms: {}, events: {} }
    expect(() => renderToString(<DashboardPanel stats={empty} days={30} setDays={() => {}} />)).not.toThrow()
  })
  it('tabelle di dispositivi, account, feedback e notifiche', () => {
    const dv = renderToString(<DevicesPanel rows={[{ device_id: 'abcdef12-0000-0000-0000-000000000000', first_day: '2026-10-01', last_day: '2026-10-10',
      active_days: 5, platform: 'ios', lang: 'it', standalone: true, signed_in: false, tx_count: 12, months_used: 1, app_version: '0.9-beta' }]} />)
    expect(dv).toContain('abcdef12'); expect(dv).toContain('1 dispositivi')
    expect(renderToString(<AccountsPanel rows={[{ email: 'a@x.it', first_name: 'Giulia', last_name: 'Rossi', created_at: '2026-10-01T10:00:00Z', last_sign_in_at: null, has_push: true, feedback_count: 2 }]} />)).toContain('a@x.it')
    const fb = renderToString(<FeedbackPanel rows={[{ id: 1, created_at: '2026-10-10T10:00:00Z', rating: 4, message: 'Bella app', lang: 'it', app_version: '0.9-beta', user_id: null }]} />)
    expect(fb).toContain('Bella app'); expect(fb).toContain('4.0')
    const pu = renderToString(<PushPanel rows={[{ lang: 'it', created_at: '2026-10-10T10:00:00Z', last_prompt_at: null, email: null }]} setup={setup} onSend={async () => ''} />)
    expect(pu).toContain('Invia a 1 dispositivi')
    expect(renderToString(<DevicesPanel rows={[]} />)).toContain('Nessun dispositivo')
  })
  it('configurazione: passi da fare e fatti', () => {
    const todo = renderToString(<SetupPanel setup={{ ...setup, tables: false, admin: false, fn: 'unknown' }} email="io@x.it" onRecheck={() => {}} />)
    expect(todo).toContain('Copia lo script'); expect(todo).toContain('io@x.it')
    const done = renderToString(<SetupPanel setup={setup} email="io@x.it" onRecheck={() => {}} />)
    expect(done.match(/az-step done/g)?.length).toBe(5)   // tabelle, funzione, chiavi, Stripe, notizie
    expect(done).toContain('Confirm email'); expect(done).toContain('Email Templates'); expect(done).toContain('Segna come fatto')
  })
  it('ricerca anonima: totali da 5 schede, sotto solo il conteggio', () => {
    const h = renderToString(<ResearchPanel r={sampleResearch} />)
    for (const x of ['Schede anonime ricevute', '1.500–2.000 €', 'Capire dove vanno i soldi', 'Revolut', 'ETF', 'Essenziali (53,6%)']) expect(h).toContain(x)
    const few = renderToString(<ResearchPanel r={{ answers: 1, min: 5 }} />)
    expect(few).toContain('Servono almeno'); expect(few).not.toContain('Carte e conti')
  })
})
