// Supabase Edge Function "billing": abbonamento Pro con Stripe (prima in modalità di prova).
// - POST {action: "checkout", interval: "month" | "year"} con l'accesso dell'utente -> indirizzo della pagina di pagamento di Stripe
// - POST {action: "portal"} con l'accesso dell'utente -> indirizzo della pagina Stripe per gestire o disdire l'abbonamento
// - POST {action: "status"} -> dice se Stripe è configurato (per la pagina Configurazione e per l'app)
// - POST da Stripe (intestazione stripe-signature) -> aggiorna la tabella subscriptions
// Segreti (Edge Functions -> Secrets): STRIPE_SECRET_KEY (sk_test_...), STRIPE_WEBHOOK_SECRET (whsec_...),
// STRIPE_PRICE_MONTHLY e STRIPE_PRICE_YEARLY (price_...). "Verify JWT" va spento: Stripe non manda l'accesso Supabase,
// la funzione controlla da sola chi la chiama.
import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://carloludovicocapizzoto.github.io/quadriamo-app/app/'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const env = (k: string) => (Deno.env.get(k) ?? '').trim().replace(/^["']|["']$/g, '')

Deno.serve(async req => {
  try { return await handle(req) } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const key = env('STRIPE_SECRET_KEY')
  const stripe = key ? new Stripe(key, { httpClient: Stripe.createFetchHttpClient() }) : null
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  // ---------- conferme da Stripe ----------
  const signature = req.headers.get('stripe-signature')
  if (signature) {
    if (!stripe || !env('STRIPE_WEBHOOK_SECRET')) return json({ error: 'not configured' }, 503)
    const event = await stripe.webhooks.constructEventAsync(await req.text(), signature, env('STRIPE_WEBHOOK_SECRET'),
      undefined, Stripe.createSubtleCryptoProvider())
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.subscription && s.client_reference_id) {
        await save(admin, await stripe.subscriptions.retrieve(String(s.subscription)), s.client_reference_id)
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      await save(admin, event.data.object as Stripe.Subscription)
    }
    return json({ received: true })
  }

  const { action, interval } = await req.json().catch(() => ({}))
  const prices = { month: env('STRIPE_PRICE_MONTHLY'), year: env('STRIPE_PRICE_YEARLY') }
  if (action === 'status') {
    return json({ configured: !!stripe && !!prices.month && !!prices.year, webhook: !!env('STRIPE_WEBHOOK_SECRET'), test: key.startsWith('sk_test_') })
  }
  if (!stripe) return json({ error: 'not configured' }, 503)

  // ---------- azioni dell'utente: serve il suo accesso ----------
  const auth = req.headers.get('Authorization') ?? ''
  const { data: { user } } = await createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } }).auth.getUser()
  if (!user) return json({ error: 'not signed in' }, 401)
  const { data: row } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()

  if (action === 'checkout') {
    const price = interval === 'year' ? prices.year : prices.month
    if (!price) return json({ error: 'price missing' }, 503)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      ...(row?.stripe_customer_id ? { customer: row.stripe_customer_id } : { customer_email: user.email }),
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${APP_URL}?pro=ok`,
      cancel_url: `${APP_URL}?pro=cancel`,
    })
    return json({ url: session.url })
  }
  if (action === 'portal') {
    if (!row?.stripe_customer_id) return json({ error: 'no subscription' }, 404)
    const portal = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: APP_URL })
    return json({ url: portal.url })
  }
  return json({ error: 'action' }, 400)
}

// deno-lint-ignore no-explicit-any
async function save(admin: any, sub: Stripe.Subscription, userId?: string) {
  const uid = userId ?? sub.metadata?.user_id
  if (!uid) return
  const item = sub.items.data[0]
  // a seconda della versione delle API, la fine del periodo è sull'abbonamento o sulla sua voce
  const end = (sub as unknown as { current_period_end?: number }).current_period_end ?? (item as unknown as { current_period_end?: number })?.current_period_end
  await admin.from('subscriptions').upsert({
    user_id: uid, status: sub.status, plan: 'pro', interval: item?.price?.recurring?.interval ?? null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null, cancel_at_period_end: sub.cancel_at_period_end,
    stripe_customer_id: String(sub.customer), stripe_subscription_id: sub.id, livemode: sub.livemode, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}
