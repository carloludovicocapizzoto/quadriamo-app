-- 12/10/2026 — Free/Pro con abbonamento Stripe (prima in modalità di prova).
-- Una riga per utente con lo stato dell'abbonamento. La scrive SOLO la funzione "billing" (chiave di servizio),
-- quando Stripe conferma un pagamento o un cambio; l'utente può solo leggere la sua.

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  status                 text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  plan                   text not null default 'pro' check (plan in ('pro')),
  interval               text check (interval in ('month', 'year')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  livemode               boolean not null default false,      -- false = modalità di prova di Stripe
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "own subscription" on public.subscriptions;
create policy "own subscription" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.subscriptions from anon;
grant select on public.subscriptions to authenticated;

-- per l'area amministratore: solo totali, nessun dato personale
create or replace function public.admin_billing_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'active', count(*) filter (where status in ('active', 'trialing')),
    'monthly', count(*) filter (where status in ('active', 'trialing') and interval = 'month'),
    'yearly', count(*) filter (where status in ('active', 'trialing') and interval = 'year'),
    'canceling', count(*) filter (where status in ('active', 'trialing') and cancel_at_period_end),
    'test', count(*) filter (where not livemode)
  ) into result from public.subscriptions;
  return result;
end;
$$;
revoke all on function public.admin_billing_stats() from public;
grant execute on function public.admin_billing_stats() to anon, authenticated;
