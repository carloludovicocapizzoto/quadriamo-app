// Cloudflare Pages Function for the separate Alpha origin. No deploy is performed
// by this file. The direct Supabase Data API rejects requests without this
// function's short-lived HMAC signature (alpha_http.check_request).
const MAX_BODY = 2 * 1024 * 1024
const METHODS = {
  'rpc/qsync_read': ['POST'],
  'rpc/qsync_write_v2': ['POST'],
  profiles: ['GET', 'HEAD', 'POST', 'PATCH'],
  subscriptions: ['GET', 'HEAD'],
}
const encoder = new TextEncoder()
const response = (status, code, retryAfter) => new Response(JSON.stringify({
  code: status === 429 ? 'PT429' : code, message: code,
  details: retryAfter ? { retry_after_seconds: retryAfter } : null,
}), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store',
    ...(retryAfter ? { 'retry-after': String(retryAfter) } : {}) },
})
const bytesToHex = bytes => [...bytes].map(x => x.toString(16).padStart(2, '0')).join('')
const fromHex = hex => new Uint8Array(hex.match(/.{2}/g).map(x => Number.parseInt(x, 16)))

async function readLimited(body) {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > MAX_BODY) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength }
  return out
}

function userIdFromJwt(authorization) {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1]
  if (!token) return null
  try {
    const claim = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')
    const user = JSON.parse(atob(claim))
    return user.role === 'authenticated' && /^[0-9a-f-]{36}$/i.test(user.sub) ? user.sub.toLowerCase() : null
  } catch { return null }
}

export async function onRequest({ request, env }) {
  const incoming = new URL(request.url)
  const route = incoming.pathname.startsWith('/api/rest/') ? incoming.pathname.slice('/api/rest/'.length) : ''
  if (!Object.hasOwn(METHODS, route) || !METHODS[route].includes(request.method) || incoming.search.length > 4096) {
    return response(404, 'ALPHA_ROUTE_DENIED')
  }
  const userId = userIdFromJwt(request.headers.get('authorization'))
  if (!userId) return response(401, 'ALPHA_AUTH_REQUIRED')
  const clientIp = request.headers.get('cf-connecting-ip')
  if (!clientIp || clientIp.length > 64) return response(503, 'ALPHA_IP_UNAVAILABLE')
  const rest = env.ALPHA_SUPABASE_REST_URL?.replace(/\/$/, '')
  const apiKey = env.ALPHA_SUPABASE_PUBLISHABLE_KEY
  const secret = env.ALPHA_GATEWAY_KEY_HEX
  if (!rest || !apiKey || !/^[0-9a-f]{64}$/.test(secret ?? '')) return response(503, 'ALPHA_GATEWAY_UNCONFIGURED')

  const key = await crypto.subtle.importKey('raw', fromHex(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const hmac = async value => bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))))
  const common = { authorization: request.headers.get('authorization'), apikey: apiKey, accept: 'application/json' }
  const signedHeaders = async (method, path, byteLength) => {
    const stamp = String(Math.floor(Date.now() / 1000))
    const signature = await hmac(`${stamp}\n${method}\n${path}\n${userId}\n${byteLength}`)
    return { ...common, 'x-alpha-ts': stamp, 'x-alpha-bytes': String(byteLength), 'x-alpha-signature': signature }
  }

  // Separate committed admission: malformed downstream SQL and lost-response
  // retries still consume HTTP budget. The direct admission RPC also needs HMAC.
  const admissionPath = 'rpc/alpha_admit_request'
  const admissionBody = encoder.encode(JSON.stringify({ p_route: route, p_ip_hash: await hmac(`ip\n${clientIp}`) }))
  let admitted
  try {
    const checked = await fetch(`${rest}/${admissionPath}`, {
      method: 'POST', headers: { ...(await signedHeaders('POST', admissionPath, admissionBody.byteLength)), 'content-type': 'application/json' }, body: admissionBody,
    })
    if (checked.status === 401 || checked.status === 403) return response(401, 'ALPHA_AUTH_REQUIRED')
    if (!checked.ok) return response(503, 'ALPHA_ADMISSION_UNAVAILABLE')
    admitted = await checked.json()
  } catch { return response(503, 'ALPHA_ADMISSION_UNAVAILABLE') }
  if (admitted?.allowed !== true) {
    const seconds = Number(admitted?.retry_after_seconds)
    return response(429, 'ALPHA_HTTP_RATE_LIMITED', Number.isInteger(seconds) && seconds > 0 ? seconds : 60)
  }

  const claimedLength = request.headers.get('content-length')
  if (claimedLength && /^\d+$/.test(claimedLength) && Number(claimedLength) > MAX_BODY) return response(413, 'ALPHA_HTTP_BODY_TOO_LARGE')
  const body = await readLimited(request.body)
  if (!body) return response(413, 'ALPHA_HTTP_BODY_TOO_LARGE')
  if (body.byteLength && !['GET', 'HEAD'].includes(request.method)) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return response(415, 'ALPHA_JSON_REQUIRED')
    try { JSON.parse(new TextDecoder().decode(body)) } catch { return response(400, 'ALPHA_JSON_INVALID') }
  }
  if (request.method === 'POST' && body.byteLength === 0) return response(400, 'ALPHA_JSON_REQUIRED')

  const headers = await signedHeaders(request.method, route, body.byteLength)
  if (body.byteLength) headers['content-type'] = 'application/json'
  const prefer = request.headers.get('prefer')
  if (prefer) headers.prefer = prefer
  let upstream
  try {
    upstream = await fetch(`${rest}/${route}${incoming.search}`, {
      method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : body,
    })
  } catch { return response(503, 'ALPHA_DATA_API_UNAVAILABLE') }
  const outgoing = new Headers({ 'cache-control': 'no-store' })
  for (const name of ['content-type', 'content-range', 'retry-after']) {
    const value = upstream.headers.get(name)
    if (value) outgoing.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers: outgoing })
}
