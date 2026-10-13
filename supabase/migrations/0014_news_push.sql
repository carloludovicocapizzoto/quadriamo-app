-- 13/10/2026 — notifiche delle notizie principali (al massimo 2 al giorno, solo quelle importanti per il budget).
-- Ogni dispositivo può spegnerle (Profilo → Notifiche). Si ricordano le notizie già inviate per non mandarle due volte.

alter table public.push_subscriptions add column if not exists news boolean not null default true;

create or replace function public.set_news_push(p_endpoint text, p_on boolean)
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions set news = p_on where endpoint = p_endpoint;
$$;
revoke all on function public.set_news_push(text, boolean) from public;
grant execute on function public.set_news_push(text, boolean) to anon, authenticated;

create table if not exists public.news_sent (
  link     text primary key,
  title    text not null,
  lang     text not null,
  sent_at  timestamptz not null default now()
);
alter table public.news_sent enable row level security;   -- nessuna policy: la usa solo la funzione send-push
revoke all on public.news_sent from anon, authenticated;
