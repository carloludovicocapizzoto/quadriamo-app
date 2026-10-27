// Il finto backend delle prove Alpha non deve mai servire file fuori dalle cartelle dichiarate né ascoltare oltre il loopback.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error: modulo JavaScript delle prove, senza tipi
import { startFakeAlpha } from './fake-alpha.mjs'

const base = mkdtempSync(join(tmpdir(), 'fake-alpha-'))
const v1 = join(base, 'app-v1'), v2 = join(base, 'app-v1-v2'), outside = join(base, 'outside')   // v2: stesso prefisso di v1
for (const d of [join(v1, 'app'), join(v2, 'app'), outside]) mkdirSync(d, { recursive: true })
writeFileSync(join(v1, 'app/index.html'), 'v1'); writeFileSync(join(v2, 'app/index.html'), 'v2'); writeFileSync(join(outside, 'secret.txt'), 'SEGRETO')
let links = true
try { symlinkSync(join(outside, 'secret.txt'), join(v1, 'link.txt')); symlinkSync(outside, join(v1, 'linkdir'), 'dir') } catch { links = false }   // Windows senza permessi

let server: { origin: string; controlToken: string; address: { address: string; port: number }; close: () => Promise<void> }
const PORT = 4196
const get = async (path: string) => { const r = await fetch(server.origin + path); return { status: r.status, text: await r.text() } }
const control = (path: string, body: unknown, token: string | null = server.controlToken) =>
  fetch(`${server.origin}/__e2e/${path}`, { method: 'POST', body: JSON.stringify(body), headers: token ? { 'x-e2e-token': token } : {} })
beforeAll(async () => { server = await startFakeAlpha({ port: PORT, fixtures: { v1, v2 } }) })
afterAll(async () => { await server?.close(); rmSync(base, { recursive: true, force: true }) })

describe('local Alpha fake: security', () => {
  it('listens only on 127.0.0.1, not on other interfaces', async () => {
    expect(server.address.address).toBe('127.0.0.1')
    const reachable = await new Promise(ok => { const s = connect({ host: '::1', port: PORT }); s.on('connect', () => { s.destroy(); ok(true) }); s.on('error', () => ok(false)) })
    expect(reachable).toBe(false)
  })
  it('serves the declared fixture', async () => {
    expect(await get('/app/')).toEqual({ status: 200, text: 'v1' })
  })
  it.each(['/%2e%2e/outside/secret.txt', '/..%2foutside%2fsecret.txt', '/%2e%2e%2foutside%2fsecret.txt', '/app/..%2f..%2foutside%2fsecret.txt',
    '/..%5coutside%5csecret.txt', '/%252e%252e/outside/secret.txt', '/%2e%2e/app-v1-v2/app/index.html', '/app/%00index.html', '/%E0%A4%A'])(
    'never leaves the fixture: %s', async path => {
      const r = await get(path)
      expect(r.text).not.toContain('SEGRETO'); expect(r.text).not.toBe('v2'); expect(r.status).not.toBe(200)
    })
  it.runIf(links)('does not follow symbolic links that point outside (file or folder)', async () => {
    for (const path of ['/link.txt', '/linkdir/secret.txt']) { const r = await get(path); expect(r.status).toBe(403); expect(r.text).not.toContain('SEGRETO') }
  })
  it('switches only to fixtures declared at start, by name; never to a path from the request', async () => {
    for (const body of [{ root: outside }, { fixture: outside }, { fixture: '../outside' }, { fixture: 'nope' }, {}]) expect((await control('root', body)).status).toBe(400)
    expect((await get('/app/')).text).toBe('v1')
    expect((await control('root', { fixture: 'v2' })).status).toBe(200); expect((await get('/app/')).text).toBe('v2')
    expect((await control('root', { fixture: 'v1' })).status).toBe(200)
  })
  it('control commands need the per-run token', async () => {
    expect((await control('root', { fixture: 'v2' }, null)).status).toBe(403)
    expect((await control('root', { fixture: 'v2' }, 'wrong')).status).toBe(403)
    expect((await fetch(`${server.origin}/__e2e/state?user=A`)).status).toBe(403)
    expect((await get('/app/')).text).toBe('v1')
  })
  it('refuses to start with undeclared, relative or missing fixtures', () => {
    expect(() => startFakeAlpha({ port: PORT + 1, fixtures: {} })).toThrow()
    expect(() => startFakeAlpha({ port: PORT + 1, fixtures: { v1: 'relative/dir' } })).toThrow()
    expect(() => startFakeAlpha({ port: PORT + 1, fixtures: { v1: join(base, 'missing') } })).toThrow()
    expect(() => startFakeAlpha({ port: PORT + 1, fixtures: { '../x': v1 } })).toThrow()
  })
})
