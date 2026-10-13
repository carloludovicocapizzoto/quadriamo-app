// Supabase Edge Function "send-push": invia la notifica "Come ti trovi con Quadriamo?" ai dispositivi iscritti.
// - mode "manual": la chiama l'amministratore dalla dashboard (serve il suo accesso) -> a tutti gli iscritti
// - mode "check": solo per l'amministratore, dice se i segreti sono impostati (pagina Configurazione della dashboard)
// - mode "morning": ogni mattina (serve CRON_SECRET) -> a chi ha attivato "Oggi puoi spendere". Il server manda solo la
//   "sveglia": il numero lo calcola il telefono con i suoi dati (push-sw.js), così nessun importo passa da qui
// - mode "nudge": ogni ora del pomeriggio (serve CRON_SECRET) -> a caso, al massimo una volta al giorno, a chi oggi non ha
//   ancora aggiornato Quadriamo (l'app comunica solo la data). Il testo, con i giorni di "slancio", lo scrive il telefono
// - mode "news": ogni 2 ore (serve CRON_SECRET) -> la notizia più importante per il budget delle ultime ore, se c'è,
//   a chi non ha spento "Notizie principali"; al massimo 2 al giorno per lingua, mai la stessa due volte
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

  if (mode === 'scheduled' || mode === 'morning' || mode === 'nudge' || mode === 'news') {
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
  if (mode === 'news') return json(await sendNews(admin, url))
  let q = admin.from('push_subscriptions').select('endpoint, p256dh, auth_key, lang, created_at, last_prompt_at, last_active, last_nudge_at')
  if (mode === 'scheduled') {
    const cutoff = new Date(Date.now() - DAYS * 864e5).toISOString()
    q = q.lt('created_at', cutoff).or(`last_prompt_at.is.null,last_prompt_at.lt.${cutoff}`)
  }
  const { data: all, error } = await q
  if (error) return json({ error: error.message }, 500)
  const subs = mode === 'nudge' ? (all ?? []).filter(nudgeToday) : all

  try {
    webpush.setVapidDetails('https://carloludovicocapizzoto.github.io/quadriamo-app/', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  } catch (e) {
    return json({ error: `chiavi VAPID non valide (controlla i segreti VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY): ${(e as Error).message}` }, 500)
  }

  let sent = 0, removed = 0, failed = 0, lastError = ''
  for (const s of subs ?? []) {
    const t = TEXT[s.lang ?? ''] ?? TEXT.en
    const payload = mode === 'morning' || mode === 'nudge'
      ? JSON.stringify({ kind: mode, lang: s.lang ?? 'en', url: APP_URL.replace('?feedback=1', mode === 'nudge' ? '?add=1' : '') })
      : JSON.stringify({ title: title || t.title, body: body || t.body, url: APP_URL })
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 86400 })
      sent++
      if (mode === 'nudge') await admin.from('push_subscriptions').update({ last_nudge_at: new Date().toISOString() }).eq('endpoint', s.endpoint)
      else if (mode !== 'morning') await admin.from('push_subscriptions').update({ last_prompt_at: new Date().toISOString() }).eq('endpoint', s.endpoint)
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) { removed++; await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) }
      else { failed++; lastError = `${code ?? ''} ${(e as Error).message ?? ''}`.trim() }
    }
  }
  return json({ mode, total: subs?.length ?? 0, sent, removed, failed, ...(lastError ? { lastError } : {}) })
}

// ---------- promemoria a sorpresa ----------
const ROME = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const HOUR = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(d))
const FIRST = 9, LAST = 20   // ore italiane in cui può arrivare

interface Sub { created_at: string; last_active: string | null; last_nudge_at: string | null }
/** Chi riceve il promemoria in questo giro: oggi non ha aggiornato, oggi non l'ha già ricevuto, e la sorte lo sceglie.
 *  La probabilità cresce con le ore che restano, così arriva a un'ora a caso ma entro sera. */
function nudgeToday(s: Sub): boolean {
  const now = new Date(), today = ROME(now), hour = HOUR(now)
  if (hour < FIRST || hour > LAST) return false
  if (s.last_active && s.last_active >= today) return false
  if (s.last_nudge_at && ROME(new Date(s.last_nudge_at)) === today) return false
  if (Date.now() - Date.parse(s.created_at) < 12 * 3600e3) return false                 // appena iscritto: domani
  const idle = s.last_active ? (Date.parse(today) - Date.parse(s.last_active)) / 864e5 : 99
  // chi non apre da più di una settimana: al massimo ogni 3 giorni (niente insistenza)
  if (idle > 7 && s.last_nudge_at && Date.now() - Date.parse(s.last_nudge_at) < 3 * 864e5) return false
  return Math.random() < 1 / Math.max(1, LAST - hour + 1)
}

// ---------- notizie principali ----------
const NEWS_TITLE: Record<string, string> = { it: 'Notizia per il tuo budget', en: 'News for your budget', fr: 'Actu pour votre budget', es: 'Noticia para tu presupuesto' }
// quello che cambia davvero il budget di una persona: tassi, prezzi, casa, bollette, tasse, bonus
const IMPORTANT: Record<string, RegExp[]> = {
  it: [/\bbce\b|tass[io] d|tagli[oa] dei tassi|rialzo dei tassi/i, /inflazion|istat.*prezz|prezzi al consumo/i, /affitt|caro casa|mutu/i, /bollett|luce e gas|prezzo del gas|energia elettrica/i,
       /benzin|carburant|gasolio|diesel/i, /bonus|manovra|legge di bilancio|irpef|isee|tasse|cuneo fiscale/i, /pension|stipend|salari/i, /student|universit|borsa di studio/i],
  en: [/\becb\b|bank of england|interest rate|rate cut|rate rise/i, /inflation|consumer prices/i, /\brent|housing|mortgage/i, /energy bill|gas price|electricity/i, /petrol|fuel/i, /\btax|budget|benefit/i, /wage|salar|pension/i, /student/i],
  fr: [/\bbce\b|taux d.intérêt|baisse des taux/i, /inflation|prix à la consommation/i, /loyer|logement|crédit immobilier/i, /facture|électricité|prix du gaz/i, /carburant|essence/i, /impôt|budget|allocation/i, /salaire|retraite/i, /étudiant/i],
  es: [/\bbce\b|tipos de interés|bajada de tipos/i, /inflaci|ipc/i, /alquiler|vivienda|hipoteca/i, /factura|luz|precio del gas/i, /gasolina|carburante/i, /impuesto|presupuesto|ayuda/i, /salario|sueldo|pensi/i, /estudiant/i],
}
const MAIN_SOURCES = /ANSA|Sole 24 Ore|BBC|Le Monde|Expansión/
const romeDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d)   // giorno italiano, con ora legale o solare
interface News { title: string; link: string; source: string; date: string | null; forYou: boolean }

// deno-lint-ignore no-explicit-any
async function sendNews(admin: any, url: string) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (hour < 9 || hour > 21) return { mode: 'news', skipped: 'night' }
  const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth_key, lang').eq('news', true)
  if (error) return { mode: 'news', error: error.message }
  webpush.setVapidDetails('https://carloludovicocapizzoto.github.io/quadriamo-app/', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const langs = [...new Set((subs ?? []).map((s: { lang: string | null }) => NEWS_TITLE[s.lang ?? ''] ? s.lang! : 'en'))] as string[]
  const out: Record<string, unknown> = {}
  for (const lang of langs) {
    const { data: sent } = await admin.from('news_sent').select('link, title, sent_at').eq('lang', lang).gte('sent_at', new Date(Date.now() - 7 * 864e5).toISOString())
    const today = (sent ?? []).filter((x: { sent_at: string }) => romeDay(new Date(x.sent_at)) === romeDay(new Date()))
    if (today.length >= 2) { out[lang] = 'limite di oggi raggiunto'; continue }
    if (today.some((x: { sent_at: string }) => Date.now() - Date.parse(x.sent_at) < 3 * 3600e3)) { out[lang] = 'troppo presto'; continue }
    const key = env('SUPABASE_ANON_KEY')
    const res = await fetch(`${url}/functions/v1/news`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) })
    const items: News[] = res.ok ? (await res.json()).items ?? [] : []
    const seen = new Set((sent ?? []).flatMap((x: { link: string; title: string }) => [x.link, x.title.toLowerCase().slice(0, 40)]))
    const score = (n: News) => (IMPORTANT[lang] ?? IMPORTANT.en).reduce((a, re) => a + (re.test(n.title) ? 3 : 0), 0) + (n.forYou ? 1 : 0) + (MAIN_SOURCES.test(n.source) ? 1 : 0)
    const best = items
      .filter(n => n.date && Date.now() - Date.parse(n.date) < 3 * 3600e3 && !seen.has(n.link) && !seen.has(n.title.toLowerCase().slice(0, 40)))
      .map(n => ({ n, s: score(n) })).filter(x => x.s >= 4).sort((a, b) => b.s - a.s)[0]
    if (!best) { out[lang] = 'nessuna notizia importante'; continue }
    await admin.from('news_sent').insert({ link: best.n.link, title: best.n.title, lang })
    let sentN = 0
    for (const s of (subs ?? []).filter((x: { lang: string | null }) => (NEWS_TITLE[x.lang ?? ''] ? x.lang : 'en') === lang)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          JSON.stringify({ kind: 'news', title: NEWS_TITLE[lang], body: `${best.n.title} (${best.n.source})`, url: APP_URL.replace('?feedback=1', '?tab=news') }), { TTL: 6 * 3600 })
        sentN++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
    out[lang] = { title: best.n.title, sent: sentN }
  }
  return { mode: 'news', ...out }
}
