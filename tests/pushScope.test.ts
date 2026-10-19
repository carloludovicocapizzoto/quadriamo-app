import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker(file: string) {
  const handlers = new Map<string, (event: unknown) => void>()
  const showNotification = vi.fn(async () => {})
  const navigate = vi.fn()
  const client = { focus: vi.fn(), navigate }
  runInNewContext(readFileSync('public/' + file, 'utf8'), {
    self: { addEventListener: (kind: string, fn: (e: unknown) => void) => handlers.set(kind, fn),
      registration: { showNotification }, location: { origin: 'https://synthetic.invalid' },
      clients: { matchAll: async () => [client], openWindow: vi.fn() } },
    URL, console,
  })
  return { handlers, showNotification, navigate }
}
describe.each(['push-sw.js', 'push-account-v2.js'])('push ownership boundary: %s', file => {
  it.each(['reminder', 'morning', 'nudge', 'message'])('never displays an unbound legacy %s payload', async kind => {
    const w = worker(file)
    let pending: Promise<unknown> = Promise.resolve()
    w.handlers.get('push')!({ data: { json: () => ({ kind, title: 'A-only', body: 'A-only 99 EUR',
      titles: ['A-only'], day: '2026-10-19', lang: 'en' }) }, waitUntil: (p: Promise<unknown>) => { pending = p } })
    await pending
    expect(w.showNotification).not.toHaveBeenCalled()
  })
  it('a click on an old private notification opens only the generic app entry', async () => {
    const w = worker(file)
    let pending: Promise<unknown> = Promise.resolve()
    w.handlers.get('notificationclick')!({ notification: { close() {}, data: { url: './app/?old-private-A=1', id: 'old-A' } },
      waitUntil: (p: Promise<unknown>) => { pending = p } })
    await pending
    expect(w.navigate).toHaveBeenCalledWith('./app/')
  })
})
