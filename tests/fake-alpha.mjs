// Finto backend Alpha per le prove in locale: serve l'app costruita in modalità alpha e risponde come
// Supabase Auth, come il gateway /api/rest/* (solo le rotte consentite nell'Alpha) e come CAS v2
// (qsync_read / qsync_write_v2: revisioni, ricevute idempotenti, conflitti, 429, 413).
// NON è un collaudo del cloud: riproduce i contratti del codice (functions/api/rest, migrazioni Alpha)
// per provare l'app con due dispositivi veri, offline e guasti. Solo localhost, solo dati inventati.
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
// le stesse rotte del gateway Alpha (functions/api/rest/[[path]].js): tutto il resto è rifiutato
const ROUTES = { 'rpc/qsync_read': ['POST'], 'rpc/qsync_write_v2': ['POST'], profiles: ['GET', 'HEAD', 'POST', 'PATCH'], subscriptions: ['GET', 'HEAD'] }
const DOCUMENT_MAX_BYTES = 1024 * 1024
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url')

/** Utenti di prova (inventati). */
export const USERS = {
  A: { id: '00000000-0000-4000-8000-00000000000a', email: 'tester-a@example.test', password: 'Prova-A-2026' },
  B: { id: '00000000-0000-4000-8000-00000000000b', email: 'tester-b@example.test', password: 'Prova-B-2026' },
  N: { id: '00000000-0000-4000-8000-00000000000c', email: 'invitato@example.test', password: null },   // invitato: sceglie la password
}

export function startFakeAlpha({ port = 4192, root }) {
  const state = {
    root, tokenSeconds: 3600, down: false,
    heads: new Map(), receipts: new Map(), refresh: new Map(), passwords: new Map(Object.values(USERS).map(u => [u.id, u.password])),
    faults: [], denied: [], log: [],
  }
  const user = id => { const u = Object.values(USERS).find(x => x.id === id); return u && { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ id: u.id, provider: 'email' }],
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' } }
  const session = id => {
    const now = Math.floor(Date.now() / 1000), exp = now + state.tokenSeconds, refresh = randomUUID()
    state.refresh.set(refresh, id)
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: `http://localhost:${port}/auth/v1`, sub: id, role: 'authenticated', aud: 'authenticated', email: user(id).email, exp, iat: now, session_id: randomUUID() })}.e2e`
    return { access_token: access, token_type: 'bearer', expires_in: state.tokenSeconds, expires_at: exp, refresh_token: refresh, user: user(id) }
  }
  const caller = req => {
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1]
    try { const c = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); return c.role === 'authenticated' && c.exp * 1000 > Date.now() ? c.sub : null } catch { return null }
  }
  const head = id => state.heads.get(id) ?? { revision: 0, document: null }
  /** Un guasto programmato per la prossima chiamata a `route` (una volta sola). */
  const fault = route => { const i = state.faults.findIndex(f => f.route === route); return i < 0 ? null : state.faults.splice(i, 1)[0] }

  async function body(req) { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString('utf8') }
  const send = (res, status, data, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
    res.end(data === undefined ? '' : JSON.stringify(data))
  }
  const gatewayError = (res, status, code, retryAfter) => send(res, status, { code: status === 429 ? 'PT429' : code, message: code,
    details: retryAfter ? { retry_after_seconds: retryAfter } : null }, retryAfter ? { 'retry-after': String(retryAfter) } : {})

  async function auth(req, res, url) {
    const path = url.pathname.slice('/auth/v1/'.length)
    if (path === 'token') {
      const b = JSON.parse(await body(req) || '{}')
      if (url.searchParams.get('grant_type') === 'password') {
        if (process.env.FAKE_DEBUG) console.log('[fake] login', JSON.stringify({ ...b, password: b.password?.length }))
        const u = Object.values(USERS).find(x => x.email === b.email)
        if (!u || !state.passwords.get(u.id) || state.passwords.get(u.id) !== b.password)
          return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
        return send(res, 200, session(u.id))
      }
      const id = state.refresh.get(b.refresh_token)
      if (!id) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' })
      state.refresh.delete(b.refresh_token)
      return send(res, 200, session(id))
    }
    if (path === 'user') {
      const id = caller(req)
      if (!id) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' })
      if (req.method === 'PUT') { const b = JSON.parse(await body(req) || '{}'); if (b.password) state.passwords.set(id, b.password) }
      return send(res, 200, user(id))
    }
    if (path === 'logout') {
      const id = caller(req)
      if (id) for (const [k, v] of state.refresh) if (v === id) state.refresh.delete(k)
      return send(res, 204)
    }
    return send(res, 404, { code: 404, msg: 'not found in the local fake' })
  }

  async function rest(req, res, route) {
    if (!Object.hasOwn(ROUTES, route) || !ROUTES[route].includes(req.method)) {
      state.denied.push(`${req.method} ${route}`); return gatewayError(res, 404, 'ALPHA_ROUTE_DENIED')
    }
    const id = caller(req)
    if (!id) return gatewayError(res, 401, 'ALPHA_AUTH_REQUIRED')
    const raw = await body(req)
    if (Buffer.byteLength(raw) > 2 * 1024 * 1024) return gatewayError(res, 413, 'ALPHA_BODY_TOO_LARGE')
    const f = fault(route)
    if (f?.kind === 'gateway429') return gatewayError(res, 429, 'ALPHA_RATE_LIMITED', f.retryAfter ?? 2)
    if (f?.kind === '500') return gatewayError(res, 500, 'ALPHA_UPSTREAM_FAILED')
    if (route === 'rpc/qsync_read') {
      const h = head(id)
      return send(res, 200, { protocol: 2, revision: String(h.revision), mode: 'protected', document: h.document, activationAllowed: false })
    }
    if (route === 'rpc/qsync_write_v2') {
      const b = JSON.parse(raw), op = b.p_operation, hash = createHash('sha256').update(b.p_document_json ?? '').digest('hex')
      const prior = state.receipts.get(op)
      if (prior) {
        if (prior.hash !== hash) return send(res, 200, { protocol: 2, status: 'rejected', operation: op, code: 'QSYNC_OPERATION_REUSED', httpStatus: 400, details: null, replay: false })
        return send(res, 200, { ...prior.response, replay: true })
      }
      if (f?.kind === 'rate') return send(res, 200, { protocol: 2, status: 'rejected', operation: op, code: 'QSYNC_RATE_LIMITED', httpStatus: 429,
        details: { retry_after_seconds: f.retryAfter ?? 2, max_operations: 200, max_payload_bytes: 33554432 }, replay: false })
      const bytes = Buffer.byteLength(b.p_document_json ?? '')
      if (f?.kind === 'tooLarge' || bytes > DOCUMENT_MAX_BYTES) return send(res, 200, { protocol: 2, status: 'rejected', operation: op,
        code: 'QSYNC_DOCUMENT_TOO_LARGE', httpStatus: 413, details: { max_bytes: DOCUMENT_MAX_BYTES, document_bytes: bytes }, replay: false })
      const h = head(id)
      let response
      if (String(h.revision) !== b.p_expected_revision) response = { protocol: 2, status: 'conflict', revision: String(h.revision), operation: op, replay: false }
      else {
        const next = { revision: h.revision + 1, document: JSON.parse(b.p_document_json) }
        state.heads.set(id, next)
        response = { protocol: 2, status: 'applied', revision: String(next.revision), operation: op, replay: false, hash }
      }
      state.receipts.set(op, { hash, response })
      state.log.push({ user: id, op, status: response.status, revision: response.revision })
      if (f?.kind === 'drop') { req.socket.destroy(); return }                           // risposta persa dopo il commit
      return send(res, 200, response)
    }
    const object = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    if (route === 'subscriptions') return object ? send(res, 406, { code: 'PGRST116', message: 'no rows' }) : send(res, 200, [])
    if (route === 'profiles') {
      const h = state.heads.get(`profile:${id}`)
      if (req.method === 'GET' || req.method === 'HEAD') return object ? (h ? send(res, 200, h) : send(res, 406, { code: 'PGRST116', message: 'no rows' })) : send(res, 200, h ? [h] : [])
      const row = JSON.parse(raw || '{}'); state.heads.set(`profile:${id}`, { ...(h ?? {}), ...(Array.isArray(row) ? row[0] : row), user_id: id })
      return send(res, 201, [])
    }
  }

  async function serveFile(res, pathname) {
    let file = normalize(join(state.root, decodeURIComponent(pathname)))
    if (!file.startsWith(normalize(state.root))) return send(res, 403, {})
    if (pathname.endsWith('/')) file = join(file, 'index.html')
    try {
      const data = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': /sw[^/]*\.js$|\.html$/.test(file) ? 'no-cache' : 'max-age=0' })
      res.end(data)
    } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found') }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    if (process.env.FAKE_DEBUG && !/\.(js|css|woff2|svg|png|json|ttf)$/.test(url.pathname)) console.log('[fake]', req.method, url.pathname + url.search)
    try {
      if (url.pathname.startsWith('/__e2e/')) return control(req, res, url)
      if (state.down && (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/'))) { req.socket.destroy(); return }
      if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url)
      if (url.pathname.startsWith('/api/rest/')) return await rest(req, res, url.pathname.slice('/api/rest/'.length))
      if (url.pathname.startsWith('/rest/v1/')) return gatewayError(res, 401, 'ALPHA_AUTH_REQUIRED')   // Data API diretta: senza firma del gateway
      if (url.pathname.startsWith('/functions/v1/') || url.pathname.startsWith('/storage/v1/')) { state.denied.push(`${req.method} ${url.pathname}`); return send(res, 404, { message: 'not available in the local fake' }) }
      return await serveFile(res, url.pathname)
    } catch (e) { send(res, 500, { message: String(e) }) }
  })

  async function control(req, res, url) {
    const b = req.method === 'POST' ? JSON.parse(await body(req) || '{}') : {}
    switch (url.pathname) {
      case '/__e2e/fault': state.faults.push(b); return send(res, 200, { ok: true })
      case '/__e2e/down': state.down = !!b.down; return send(res, 200, { ok: true })
      case '/__e2e/tokens': state.tokenSeconds = b.seconds ?? 3600; return send(res, 200, { ok: true })
      case '/__e2e/revoke': for (const [k, v] of state.refresh) if (v === USERS[b.user].id) state.refresh.delete(k); return send(res, 200, { ok: true })
      case '/__e2e/root': state.root = b.root; return send(res, 200, { ok: true })
      case '/__e2e/state': { const id = USERS[url.searchParams.get('user')]?.id; const h = head(id)
        return send(res, 200, { revision: h.revision, document: h.document, denied: state.denied, log: state.log.filter(x => x.user === id) }) }
      case '/__e2e/invite': { const id = USERS[b.user].id; return send(res, 200, session(id)) }
      default: return send(res, 404, {})
    }
  }

  return new Promise(ok => server.listen(port, () => ok({ state, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r) }) })))
}

// Avviato a mano (npm run alpha:local): l'app Alpha già costruita in dist-alpha-e2e (npm run e2e:alpha la costruisce)
// su http://localhost:4192/app/, con gli utenti di prova qui sopra. Per provare l'Alpha senza toccare il cloud.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const root = new URL('../dist-alpha-e2e', import.meta.url).pathname
  await startFakeAlpha({ root })
  console.log(`Alpha locale (backend simulato): http://localhost:4192/app/\nUtenti di prova: ${Object.values(USERS).filter(u => u.password).map(u => `${u.email} / ${u.password}`).join(' · ')}`)
}
