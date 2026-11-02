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

it('first-release manifest stays unapproved and, once approved offline, seeds four inactive scoped sources', () => {
  const manifest = JSON.parse(readFileSync('supabase/alpha-news/sources.first-release.json', 'utf8'))
  expect(manifest.approvedBy).toBe('')
  expect(manifest.sources.map((s: { id: string }) => s.id)).toEqual(['ecb-press', 'ecb-stats', 'istat', 'eurostat'])
  expect(manifest.sources.every((s: { imageRights?: unknown }) => s.imageRights === undefined)).toBe(true)
  const root = mkdtempSync(join(tmpdir(), 'quadriamo-first-release-')), input = join(root, 'manifest.json'), output = join(root, 'out')
  try {
    expect(spawnSync(process.execPath, ['tools/news/prepare-alpha.mjs', 'supabase/alpha-news/sources.first-release.json', output], { stdio: 'ignore' }).status).not.toBe(0)
    writeFileSync(input, JSON.stringify({ ...manifest, approvedBy: 'synthetic-editor' }))
    expect(spawnSync(process.execPath, ['tools/news/prepare-alpha.mjs', input, output], { stdio: 'ignore' }).status).toBe(0)
    const sql = readFileSync(join(output, 'seed-inactive.sql'), 'utf8')
    expect(sql.match(/,false,false,/g)).toHaveLength(4)
    expect(sql).toContain("ARRAY['/comunicato-stampa/']::text[]")
    expect(sql).toContain('on conflict(id) do nothing')
    const config = JSON.parse(readFileSync(join(output, 'config.json'), 'utf8'))
    expect(config).toMatchObject({ ALPHA_NEWS_ENABLED: '0', ALPHA_NEWS_INGEST_ENABLED: '0', NEWS_ALLOWED_HOSTS: 'ec.europa.eu,www.ecb.europa.eu,www.istat.it', sources: 4 })
    writeFileSync(input, JSON.stringify({ ...manifest, approvedBy: 'synthetic-editor', sources: [{ ...manifest.sources[2], linkPrefixes: ['comunicato-stampa'] }] }))
    expect(spawnSync(process.execPath, ['tools/news/prepare-alpha.mjs', input, output], { stdio: 'ignore' }).status).not.toBe(0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
