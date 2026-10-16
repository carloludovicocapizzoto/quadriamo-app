// Una mail all'amministratore per ogni nuova segnalazione dei tester (tabella tester_reports, 0026).
// La chiama il database appena arriva una segnalazione (0027), con il segreto CRON. Spedisce Resend
// (gratuito; senza dominio proprio può scrivere solo all'indirizzo con cui ci si è registrati: è quello che serve).
// Segreti da impostare in Supabase (Edge Functions -> Secrets): RESEND_API_KEY, NOTIFY_EMAIL (dove arrivano le mail),
// CRON_SECRET (lo stesso di send-push). SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY ci sono già.
// - { id }            dal database (serve CRON_SECRET): la mail della segnalazione
// - { mode: 'check' } dall'area amministratore: dice solo se i segreti ci sono (nessun valore)
// - { mode: 'test' }  dall'area amministratore (solo l'amministratore): una mail di prova
import { createClient } from 'npm:@supabase/supabase-js@2'

const ADMIN_URL = 'https://carloludovicocapizzoto.github.io/quadriamo-app/admin/?panel=segnalazioni'
const PRIORITY: Record<string, string> = { blocking: 'Bloccante', high: 'Alta', normal: 'Normale', low: 'Bassa' }
const KIND: Record<string, string> = { bug: 'Problema', idea: 'Idea' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
// i segreti incollati a mano possono avere spazi, a capo o virgolette in più
const env = (k: string) => (Deno.env.get(k) ?? '').trim().replace(/^["']|["']$/g, '')
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

Deno.serve(async req => {
  try { return await handle(req) } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

async function send(subject: string, html: string, text: string, replyTo?: string | null) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Quadriamo <onboarding@resend.dev>', to: [env('NOTIFY_EMAIL')], subject, html, text,
      ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { id, mode } = await req.json().catch(() => ({}))
  const url = Deno.env.get('SUPABASE_URL')!
  const configured = !!env('RESEND_API_KEY') && !!env('NOTIFY_EMAIL')

  if (mode === 'check') return json({ ok: true, configured, cron: !!env('CRON_SECRET') })

  if (mode === 'test') {
    // solo l'amministratore (con il suo accesso o con il codice x-admin-key), come in send-push
    const auth = req.headers.get('Authorization') ?? ''
    const headers: Record<string, string> = { 'x-admin-key': req.headers.get('x-admin-key') ?? '' }
    if (auth.startsWith('Bearer eyJ')) headers.Authorization = auth
    const { data: ok } = await createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers } }).rpc('is_admin')
    if (ok !== true) return json({ error: 'forbidden' }, 403)
    if (!configured) return json({ error: 'Mancano RESEND_API_KEY o NOTIFY_EMAIL nei segreti' }, 400)
    await send('Quadriamo: mail di prova', `<p>Le mail delle segnalazioni funzionano.</p><p><a href="${ADMIN_URL}">Apri le segnalazioni</a></p>`,
      `Le mail delle segnalazioni funzionano.\n${ADMIN_URL}`)
    return json({ ok: true })
  }

  if (!env('CRON_SECRET') || (req.headers.get('x-cron-secret') ?? '').trim() !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403)
  if (!configured || typeof id !== 'string') return json({ ok: false, skipped: true })

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: r, error } = await db.from('tester_reports').select('*').eq('id', id).maybeSingle()
  if (error || !r) return json({ error: error?.message ?? 'non trovata' }, 404)
  const email = r.user_id ? (await db.auth.admin.getUserById(r.user_id)).data.user?.email ?? null : null
  const d = r.diagnostics ?? {}
  const device = [d.os, d.installed ? 'app installata' : d.os ? 'nel browser' : null, d.lang, d.screen].filter(Boolean).join(' · ')
  const lines: [string, string][] = [
    ['Tipo', KIND[r.kind] ?? r.kind], ['Priorità', PRIORITY[r.priority] ?? r.priority],
    ['Da', email ?? 'senza account'], ['Dispositivo', device || '—'], ['Versione', `${r.version ?? '—'}${d.commit ? ` (commit ${d.commit})` : ''}`],
    ['Schermata', d.route ?? '—'], ['Allegati', String(r.attachments?.length ?? 0)],
  ]
  const first = r.message.split('\n')[0].slice(0, 70)
  const subject = `${r.priority === 'blocking' || r.priority === 'high' ? '❗ ' : ''}${KIND[r.kind] ?? 'Segnalazione'} · ${PRIORITY[r.priority] ?? ''}: ${first}`
  const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#17181A;max-width:560px">
    <p style="white-space:pre-wrap;font-size:16px;margin:0 0 16px">${esc(r.message)}</p>
    <table style="border-collapse:collapse;font-size:14px">${lines.map(([k, v]) =>
      `<tr><td style="color:#6B6B6B;padding:3px 16px 3px 0">${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <p style="margin:20px 0"><a href="${ADMIN_URL}" style="background:#17181A;color:#F6F4EF;padding:10px 16px;border-radius:10px;text-decoration:none">Apri nell'area amministratore</a></p>
    <p style="color:#6B6B6B;font-size:12px">${email ? 'Rispondi a questa mail per scrivere direttamente a chi ha segnalato.' : 'Chi ha segnalato non aveva fatto l’accesso: non si può rispondere.'}</p></div>`
  const text = `${r.message}\n\n${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${ADMIN_URL}`
  await send(subject, html, text, email)
  return json({ ok: true })
}
