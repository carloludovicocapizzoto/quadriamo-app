import { ENV } from '../env'

// La nuova Alpha manda solo la Data API alla funzione della propria origine.
// Auth e Storage usano il progetto Supabase Alpha; il suo endpoint REST diretto
// richiede comunque la firma privata della funzione Pages.
// Il corpo si inoltra già letto (byte), non come flusso: copiare una Request con corpo ne fa uno stream,
// che Safari e Firefox non sanno inviare e che su HTTP/1.1 fallisce sempre ("Failed to fetch").
export const alphaFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init)
  const direct = ENV.supabase?.url.replace(/\/$/, '') + '/rest/v1/'
  if (ENV.name !== 'alpha' || !ENV.supabase || !request.url.startsWith(direct)) return fetch(request)
  const path = request.url.slice(direct.length)
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer()
  return fetch(`${location.origin}${ENV.base}api/rest/${path}`, { method: request.method, headers: request.headers, body, signal: request.signal,
    credentials: request.credentials, cache: request.cache, redirect: request.redirect, referrerPolicy: request.referrerPolicy, keepalive: request.keepalive })
}
