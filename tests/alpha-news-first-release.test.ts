import * as policy from '../supabase/functions/_shared/alpha-news-policy'
import * as feed from '../supabase/functions/_shared/news-feed'
import * as rules from '../supabase/functions/_shared/news-rules'
import * as items from '../supabase/functions/_shared/news-item'
import { expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

it('source scope keeps only configured article paths and tidies doubled slashes', () => {
  expect(policy.allowedPath('https://www.istat.it/comunicato-stampa/prezzi-al-consumo/', ['/comunicato-stampa/'])).toBe(true)
  expect(policy.allowedPath('https://www.istat.it/evento/convegno/', ['/comunicato-stampa/'])).toBe(false)
  expect(policy.allowedPath('https://www.ecb.europa.eu//press/pr/date/2026/html/x.en.html', ['/press/pr/'])).toBe(true)
  expect(policy.allowedPath('https://www.ecb.europa.eu//press/key/date/2026/html/speech.en.html', ['/press/pr/'])).toBe(false)
  expect(policy.allowedPath('https://source.example.com/any', [])).toBe(true)
  expect(policy.allowedPath('not a url', ['/press/'])).toBe(false)
  expect(policy.tidyLink('https://www.ecb.europa.eu//press/pr/x.en.html')).toBe('https://www.ecb.europa.eu/press/pr/x.en.html')
})

it('Eurostat Atom manifest is scoped, parseable, and remains excluded until Alpha egress is approved', () => {
  const manifest = JSON.parse(readFileSync('supabase/alpha-news/sources.first-release.json', 'utf8'))
  const source = manifest.sources.find((s: { id: string }) => s.id === 'eurostat')
  expect(source).toMatchObject({ hold: true, linkPrefixes: ['/eurostat/product'], rights: { titleAllowed: true, licenceName: 'CC BY 4.0', attribution: 'Eurostat' } })
  const atom = '<feed><entry><title>Inflation update</title><updated>2026-11-02T10:00:00Z</updated><link rel="alternate" href="https://ec.europa.eu/eurostat/product?code=synthetic"/></entry></feed>'
  const [item] = feed.parse(atom)
  expect(item.link).toBe('https://ec.europa.eu/eurostat/product?code=synthetic')
  expect(policy.approvedUrl(source.feed, ['ec.europa.eu'])).toBe(true)
  expect(policy.approvedUrl(item.link, ['ec.europa.eu'])).toBe(true)
  expect(policy.allowedPath(item.link, source.linkPrefixes)).toBe(true)
  expect(policy.allowedPath('https://ec.europa.eu/eurostat/en/unrelated', source.linkPrefixes)).toBe(false)
  expect(rules.canonical(item.link)).toContain('?code=synthetic')
  expect(policy.approvedImage('https://ec.europa.eu/eurostat/image.png', { images: false })).toBeNull()
})

it('SIMULATED ingest stores original headlines inside the source scope and skips items older than retention', async () => {
  const env: Record<string, string> = { ALPHA_NEWS_INGEST_ENABLED: '1', CRON_SECRET: 'synthetic', SUPABASE_URL: 'https://djkoxecmobafenfazcum.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-key', NEWS_ALLOWED_HOSTS: 'feed.example.com,source.example.com' }
  const src = { id: 'scoped', name: 'Synthetic', kind: 'institution', format: 'rss', feed: 'https://feed.example.com/rss', lang: 'it', trust: 5, topics: ['economy'], images: false, link_prefixes: ['/comunicato-stampa/'] }
  const saved: Record<string, unknown>[] = []; let handler!: (r: Request) => Promise<Response>
  const from = (table: string) => { let op = 'select'; const q: Record<string, unknown> = { select: () => q, eq: () => q, order: () => q, limit: () => q, gte: () => q, lt: () => q, delete: () => { op = 'delete'; return q }, update: () => { op = 'update'; return q }, upsert: (x: Record<string, unknown>[]) => { op = 'upsert'; saved.push(...x); return q }, then: (ok: (x: unknown) => unknown) => Promise.resolve(ok({ data: op === 'select' ? (table === 'news_sources' ? [src] : []) : null, error: null })) }; return q }
  const day = 864e5, at = (d: number) => new Date(Date.now() - d * day).toUTCString()
  const xml = '<rss><channel>'
    + `<item><title>Prezzi al consumo e inflazione delle famiglie - by Istat</title><link>https://source.example.com//comunicato-stampa/prezzi/</link><pubDate>${at(1)}</pubDate></item>`
    + `<item><title>Convegno sulla statistica e il risparmio</title><link>https://source.example.com/evento/convegno/</link><pubDate>${at(1)}</pubDate></item>`
    + `<item><title>Occupati e disoccupati, stima del mese scorso</title><link>https://source.example.com/comunicato-stampa/lavoro/</link><pubDate>${at(20)}</pubDate></item>`
    + '</channel></rss>'
  const remote = vi.fn(async () => new Response(xml))
  const js = ts.transpileModule(readFileSync('supabase/functions/alpha-news-ingest/index.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(js, { exports: {}, require: (n: string) => n.startsWith('npm:') ? { createClient: () => ({ from }) } : n.includes('alpha-news-policy') ? policy : n.includes('news-feed') ? feed : n.includes('news-rules') ? rules : items, Deno: { env: { get: (k: string) => env[k] }, serve: (f: typeof handler) => { handler = f } }, fetch: remote, Response, URL, AbortSignal, TextEncoder, TextDecoder, Uint8Array, crypto, Date })
  const res = await handler(new Request('https://local.invalid', { method: 'POST', headers: { 'x-cron-secret': 'synthetic' } }))
  expect(res.status).toBe(200)
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ title: 'Prezzi al consumo e inflazione delle famiglie - by Istat', link: 'https://source.example.com/comunicato-stampa/prezzi', excerpt: null, thumb: null })
})

it('first-release manifest: BCE and ISTAT approved, Eurostat held, every seeded source inactive with its credit line', () => {
  const manifest = JSON.parse(readFileSync('supabase/alpha-news/sources.first-release.json', 'utf8'))
  expect(manifest.approvedBy).toMatch(/Carlo Capizzoto/)
  expect(manifest.sources.map((s: { id: string }) => s.id)).toEqual(['ecb-press', 'ecb-stats', 'istat', 'eurostat'])
  expect(manifest.sources.find((s: { id: string }) => s.id === 'eurostat').hold).toBe(true)
  expect(manifest.sources.every((s: { imageRights?: unknown }) => s.imageRights === undefined)).toBe(true)
  const root = mkdtempSync(join(tmpdir(), 'quadriamo-first-release-')), input = join(root, 'manifest.json'), output = join(root, 'out')
  const run = (m: unknown) => { writeFileSync(input, JSON.stringify(m)); return spawnSync(process.execPath, ['tools/news/prepare-alpha.mjs', input, output], { stdio: 'ignore' }).status }
  try {
    expect(run({ ...manifest, approvedBy: '' })).not.toBe(0)
    expect(spawnSync(process.execPath, ['tools/news/prepare-alpha.mjs', 'supabase/alpha-news/sources.first-release.json', output], { stdio: 'ignore' }).status).toBe(0)
    const sql = readFileSync(join(output, 'seed-inactive.sql'), 'utf8')
    expect(sql.match(/,false,false,/g)).toHaveLength(3)
    expect(sql).not.toContain('eurostat')
    expect(sql).toContain("ARRAY['/comunicato-stampa/']::text[],'Istat','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/deed.it')")
    expect(sql).toContain("ARRAY['/press/pr/','/press/govcdec/']::text[],'BCE',null,null)")
    expect(sql).toContain('on conflict(id) do nothing')
    const config = JSON.parse(readFileSync(join(output, 'config.json'), 'utf8'))
    expect(config).toMatchObject({ ALPHA_NEWS_ENABLED: '0', ALPHA_NEWS_INGEST_ENABLED: '0', NEWS_ALLOWED_HOSTS: 'www.ecb.europa.eu,www.istat.it', held: ['eurostat'], sources: 3 })
    const istat = manifest.sources[2]
    expect(run({ ...manifest, sources: [{ ...istat, linkPrefixes: ['comunicato-stampa'] }] })).not.toBe(0)
    expect(run({ ...manifest, sources: [{ ...istat, rights: { ...istat.rights, attribution: '' } }] })).not.toBe(0)
    expect(run({ ...manifest, sources: [{ ...istat, rights: { ...istat.rights, licenceName: undefined } }] })).not.toBe(0)
    expect(run({ ...manifest, sources: [{ ...istat, rights: { ...istat.rights, licence: 'http://creativecommons.org/licenses/by/4.0/' } }] })).not.toBe(0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

it('credit line: «Fonte: Istat · CC BY 4.0» links the licence; BCE links its terms; nothing without attribution', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const { Credit } = await import('../src/ui/screens/NewsScreen')
  const { I18nProvider } = await import('../src/i18n')
  const dict = (await import('../src/i18n/it')).default
  const html = (source: Record<string, unknown>) => renderToStaticMarkup(createElement(I18nProvider, { start: { lang: 'it', dict } } as never, createElement(Credit, { source: { name: 'x', kind: 'institution', paywall: false, trust: 5, ...source } as never })))
  const istat = html({ attribution: 'Istat', licence_name: 'CC BY 4.0', licence_url: 'https://creativecommons.org/licenses/by/4.0/deed.it', rights_reference: 'https://www.istat.it/note-legali/' })
  expect(istat).toContain('Fonte: Istat')
  expect(istat).toMatch(/href="https:\/\/creativecommons.org\/licenses\/by\/4.0\/deed.it"[^>]*>CC BY 4.0</)
  expect(html({ attribution: 'BCE', rights_reference: 'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html' })).toMatch(/Fonte: BCE.*href="https:\/\/www.ecb.europa.eu\/services\/disclaimer\/html\/index.en.html"[^>]*>Condizioni d(&#x27;|')uso</)
  expect(html({ attribution: 'Istat', licence_name: 'CC BY 4.0', licence_url: 'javascript:alert(1)' })).not.toContain('javascript:')
  expect(html({ attribution: '' })).toBe('')
})

it('SIMULATED ingest: secret compared in constant time, status write failures reported instead of ignored', async () => {
  const env: Record<string, string> = { ALPHA_NEWS_INGEST_ENABLED: '1', CRON_SECRET: 'synthetic-secret', SUPABASE_URL: 'https://djkoxecmobafenfazcum.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-key', NEWS_ALLOWED_HOSTS: 'feed.example.com,source.example.com' }
  const src = { id: 'status', name: 'Synthetic', kind: 'institution', format: 'rss', feed: 'https://feed.example.com/rss', lang: 'it', trust: 5, topics: [], images: false }
  let statusError: unknown = null; let handler!: (r: Request) => Promise<Response>
  const from = (table: string) => { let op = 'select'; const q: Record<string, unknown> = { select: () => q, eq: () => q, order: () => q, limit: () => q, gte: () => q, lt: () => q, delete: () => { op = 'delete'; return q }, update: () => { op = 'update'; return q }, upsert: () => { op = 'upsert'; return q }, then: (ok: (x: unknown) => unknown) => Promise.resolve(ok({ data: op === 'select' ? (table === 'news_sources' ? [src] : []) : null, error: op === 'update' ? statusError : null })) }; return q }
  const remote = vi.fn(async () => new Response('<rss><channel></channel></rss>'))
  const js = ts.transpileModule(readFileSync('supabase/functions/alpha-news-ingest/index.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(js, { exports: {}, require: (n: string) => n.startsWith('npm:') ? { createClient: () => ({ from }) } : n.includes('alpha-news-policy') ? policy : n.includes('news-feed') ? feed : n.includes('news-rules') ? rules : items, Deno: { env: { get: (k: string) => env[k] }, serve: (f: typeof handler) => { handler = f } }, fetch: remote, Response, URL, AbortSignal, TextEncoder, TextDecoder, Uint8Array, crypto, Date, Promise })
  const post = (secret: string) => handler(new Request('https://local.invalid', { method: 'POST', headers: { 'x-cron-secret': secret } }))
  expect((await post('synthetic-secreT')).status).toBe(403)
  expect((await post('synthetic')).status).toBe(403)
  expect(remote).not.toHaveBeenCalled()
  expect((await post('synthetic-secret')).status).toBe(200)
  statusError = { message: 'synthetic write failure' }
  const failed = await post('synthetic-secret')
  expect(failed.status).toBe(500)
  expect(await failed.json()).toMatchObject({ error: 'source status update failed', statusFailed: ['status'] })
})
