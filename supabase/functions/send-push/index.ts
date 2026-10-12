// Supabase Edge Function "send-push": invia la notifica "Come ti trovi con Quadriamo?" ai dispositivi iscritti.
// - mode "manual": la chiama l'amministratore dalla dashboard (serve il suo accesso) -> a tutti gli iscritti
// - mode "check": solo per l'amministratore, dice se i segreti sono impostati (pagina Configurazione della dashboard)
// - mode "morning": ogni mattina (serve CRON_SECRET) -> a chi ha attivato "Oggi puoi spendere". Il server manda solo la
//   "sveglia": il numero lo calcola il telefono con i suoi dati (push-sw.js), così nessun importo passa da qui
// - mode "scheduled": la chiama il promemoria automatico giornaliero (serve CRON_SECRET) -> a chi non riceve
//   un promemoria da almeno 10 giorni
// Segreti da impostare in Supabase (Edge Functions -> Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sono già disponibili nelle funzioni.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://carloludovicocapizzoto.github.io/quadriamo-app/app/?feedback=1'
const DAYS = 10

const TEXT: Record<string, { title: string; body: string }> = {
  it: { title: 'Come ti trovi con Quadriamo?', body: 'Dacci un parere in 30 secondi: ci aiuta a migliorare la beta.' },
  en: { title: 'How is Quadriamo working for you?', body: 'Give us 30 seconds of feedback: it helps us improve the beta.' },
  fr: { title: 'Comment se passe Quadriamo ?', body: 'Donnez-nous votre avis en 30 secondes : il nous aide à améliorer la bêta.' },
  es: { title: '¿Qué tal te va con Quadriamo?', body: 'Danos tu opinión en 30 segundos: nos ayuda a mejorar la beta.' },
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
// i segreti incollati a mano possono avere spazi, a capo o virgolette in più
const env = (k: string) => (Deno.env.get(k) ?? '').trim().replace(/^["']|["']$/g, '')

Deno.serve(async req => {
  try { return await handle(req) } catch (e) {
    // risposta leggibile invece di "Internal Server Error" (nessun segreto nel messaggio)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const { mode = 'manual', title, body } = await req.json().catch(() => ({}))
  const url = Deno.env.get('SUPABASE_URL')!

  if (mode === 'scheduled' || mode === 'morning') {
    if (!env('CRON_SECRET') || (req.headers.get('x-cron-secret') ?? '').trim() !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403)
  } else {
    // solo l'amministratore: si controlla con il SUO accesso (o con il suo codice x-admin-key), tramite is_admin()
    const auth = req.headers.get('Authorization') ?? ''
    const headers: Record<string, string> = { 'x-admin-key': req.headers.get('x-admin-key') ?? '' }
    if (auth.startsWith('Bearer eyJ')) headers.Authorization = auth   // solo un vero accesso utente (JWT)
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers } })
    const { data: ok } = await asUser.rpc('is_admin')
    if (ok !== true) return json({ error: 'forbidden' }, 403)
    if (mode === 'check') return json({ ok: true, vapid: !!env('VAPID_PUBLIC_KEY') && !!env('VAPID_PRIVATE_KEY'), cron: !!env('CRON_SECRET') })
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let q = admin.from('push_subscriptions').select('endpoint, p256dh, auth_key, lang, created_at, last_prompt_at')
  if (mode === 'morning') q = q.eq('morning', true)
  if (mode === 'scheduled') {
    const cutoff = new Date(Date.now() - DAYS * 864e5).toISOString()
    q = q.lt('created_at', cutoff).or(`last_prompt_at.is.null,last_prompt_at.lt.${cutoff}`)
  }
  const { data: subs, error } = await q
  if (error) return json({ error: error.message }, 500)

  try {
    webpush.setVapidDetails('https://carloludovicocapizzoto.github.io/quadriamo-app/', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  } catch (e) {
    return json({ error: `chiavi VAPID non valide (controlla i segreti VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY): ${(e as Error).message}` }, 500)
  }

  let sent = 0, removed = 0, failed = 0, lastError = ''
  for (const s of subs ?? []) {
    const t = TEXT[s.lang ?? ''] ?? TEXT.en
    const payload = mode === 'morning'
      ? JSON.stringify({ kind: 'morning', lang: s.lang ?? 'en', url: APP_URL.replace('?feedback=1', '') })
      : JSON.stringify({ title: title || t.title, body: body || t.body, url: APP_URL })
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 86400 })
      sent++
      if (mode !== 'morning') await admin.from('push_subscriptions').update({ last_prompt_at: new Date().toISOString() }).eq('endpoint', s.endpoint)
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) { removed++; await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) }
      else { failed++; lastError = `${code ?? ''} ${(e as Error).message ?? ''}`.trim() }
    }
  }
  return json({ mode, total: subs?.length ?? 0, sent, removed, failed, ...(lastError ? { lastError } : {}) })
}
