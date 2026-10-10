import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminDashboard, type Stats } from './AdminView'

// stessi numeri restituiti da admin_stats() nella prova con PGlite
const stats: Stats = {
  devices: 4, active_1: 2, active_7: 3, active_30: 4, accounts: 2, installed: 1, signed_in: 1, with_tx: 2, activated: 1, avg_tx: 8.7,
  push: 1, feedback_count: 1, feedback_avg: 4, retention_7: 50, retention_30: 100,
  daily: [{ day: '2026-10-09', active: 1, new: 0 }, { day: '2026-10-10', active: 2, new: 2 }],
  langs: { it: 2, en: 1, '?': 1 }, platforms: { ios: 1, android: 1, desktop: 1 }, events: { open: 4, share: 1 },
}
const html = (st = stats) => renderToString(<AdminDashboard stats={st} days={30}
  feedback={[{ id: 1, created_at: '2026-10-10T10:00:00Z', rating: 4, message: 'Bella app', lang: 'it', app_version: '0.9-beta', user_id: null }]}
  push={{ title: '', body: '', busy: false, result: '' }} setPush={() => {}} onSendPush={() => {}} />)

describe('admin dashboard', () => {
  it('shows the key numbers, the funnel, languages and feedback', () => {
    const h = html()
    for (const s of ['Dispositivi totali', 'Tornano dopo 7 giorni', '50%', 'Attivati (6+ movimenti', 'Italiano', 'iPhone / iPad',
                     'Inviti inviati', 'Bella app', 'voto medio 4/5', 'Invia notifica di feedback']) expect(h).toContain(s)
  })
  it('works with an empty database', () => {
    const empty: Stats = { ...stats, devices: 0, active_1: 0, active_7: 0, active_30: 0, with_tx: 0, activated: 0, push: 0, feedback_count: 0,
      feedback_avg: null, retention_7: null, retention_30: null, daily: null, langs: {}, platforms: {}, events: {} }
    expect(() => html(empty)).not.toThrow()
  })
})
