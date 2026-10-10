-- Quadriamo beta: feedback, statistiche d'uso anonime (solo con consenso), iscrizioni alle notifiche push,
-- e un'area riservata all'amministratore. Da eseguire una volta in Supabase: SQL Editor -> New snippet -> Run.
-- Principio: chiunque può INVIARE (feedback, statistiche, iscrizione), solo l'amministratore può LEGGERE.

-- ---------- amministratori ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;   -- nessuna policy: dall'app nessuno legge questa tabella

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- statistiche d'uso (anonime, inviate solo con il consenso dell'utente) ----------
create table if not exists public.usage_events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  day          date not null default ((now() at time zone 'utc')::date),
  device_id    uuid not null,                      -- casuale, generato sul dispositivo: non identifica la persona
  event        text not null check (event in ('open','install','import','share','feedback','push_on')),
  lang         text check (char_length(lang) <= 8),
  platform     text check (char_length(platform) <= 16),
  standalone   boolean,                            -- app installata (aperta dall'icona)
  signed_in    boolean,
  tx_count     int check (tx_count between 0 and 1000000),
  months_used  int check (months_used between 0 and 1200),
  app_version  text check (char_length(app_version) <= 16)
);
create index if not exists usage_events_day on public.usage_events (day);
create index if not exists usage_events_device on public.usage_events (device_id);
alter table public.usage_events enable row level security;
drop policy if exists "anyone can send usage" on public.usage_events;
create policy "anyone can send usage" on public.usage_events for insert to anon, authenticated with check (true);
grant insert on public.usage_events to anon, authenticated;

-- ---------- feedback ----------
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  device_id   uuid,
  user_id     uuid default auth.uid(),
  rating      int check (rating between 1 and 5),
  message     text check (char_length(message) <= 4000),
  lang        text check (char_length(lang) <= 8),
  app_version text check (char_length(app_version) <= 16)
);
alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated
  with check (rating is not null or char_length(coalesce(message, '')) > 0);
grant insert on public.feedback to anon, authenticated;

-- ---------- iscrizioni alle notifiche push ----------
create table if not exists public.push_subscriptions (
  endpoint        text primary key check (char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth_key        text not null check (char_length(auth_key) <= 100),
  device_id       uuid,
  user_id         uuid,
  lang            text check (char_length(lang) <= 8),
  created_at      timestamptz not null default now(),
  last_prompt_at  timestamptz
);
alter table public.push_subscriptions enable row level security;   -- nessuna policy: si passa dalle funzioni qui sotto

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device uuid, p_lang text)
returns void language sql security definer set search_path = '' as $$
  insert into public.push_subscriptions (endpoint, p256dh, auth_key, device_id, user_id, lang)
  values (p_endpoint, p_p256dh, p_auth, p_device, auth.uid(), p_lang)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth_key = excluded.auth_key,
    device_id = excluded.device_id, user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id), lang = excluded.lang;
$$;
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function public.save_push_subscription(text, text, text, uuid, text) from public;
revoke all on function public.remove_push_subscription(text) from public;
grant execute on function public.save_push_subscription(text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.remove_push_subscription(text) to anon, authenticated;

-- ---------- dashboard dell'amministratore ----------
create or replace function public.admin_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  since date := (now() at time zone 'utc')::date - greatest(1, least(p_days, 365)) + 1;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  with ev as (select * from public.usage_events),
  firsts as (select device_id, min(day) as first_day from ev group by device_id),
  last_snap as (
    select distinct on (device_id) device_id, tx_count, months_used, standalone, signed_in, lang, platform
    from ev where event = 'open' order by device_id, day desc, created_at desc
  ),
  days as (select generate_series(since, (now() at time zone 'utc')::date, interval '1 day')::date as day)
  select jsonb_build_object(
    'devices',        (select count(*) from firsts),
    'active_1',       (select count(distinct device_id) from ev where day = (now() at time zone 'utc')::date),
    'active_7',       (select count(distinct device_id) from ev where day > (now() at time zone 'utc')::date - 7),
    'active_30',      (select count(distinct device_id) from ev where day > (now() at time zone 'utc')::date - 30),
    'accounts',       (select count(*) from auth.users),
    'installed',      (select count(*) from last_snap where standalone),
    'signed_in',      (select count(*) from last_snap where signed_in),
    'with_tx',        (select count(*) from last_snap where tx_count > 0),
    'activated',      (select count(*) from last_snap where tx_count >= 6),
    'avg_tx',         (select coalesce(round(avg(tx_count)::numeric, 1), 0) from last_snap),
    'push',           (select count(*) from public.push_subscriptions),
    'feedback_count', (select count(*) from public.feedback),
    'feedback_avg',   (select round(avg(rating)::numeric, 2) from public.feedback),
    'retention_7',    (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where back) / count(*), 1) end
                         from (select f.device_id, exists (select 1 from ev e where e.device_id = f.device_id and e.day >= f.first_day + 7) as back
                               from firsts f where f.first_day <= (now() at time zone 'utc')::date - 7) r),
    'retention_30',   (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where back) / count(*), 1) end
                         from (select f.device_id, exists (select 1 from ev e where e.device_id = f.device_id and e.day >= f.first_day + 30) as back
                               from firsts f where f.first_day <= (now() at time zone 'utc')::date - 30) r),
    'daily',          (select jsonb_agg(jsonb_build_object('day', d.day,
                         'active', (select count(distinct device_id) from ev where ev.day = d.day),
                         'new', (select count(*) from firsts where first_day = d.day)) order by d.day) from days d),
    'langs',          (select coalesce(jsonb_object_agg(coalesce(lang, '?'), n), '{}') from (select lang, count(*) n from last_snap group by lang) x),
    'platforms',      (select coalesce(jsonb_object_agg(coalesce(platform, '?'), n), '{}') from (select platform, count(*) n from last_snap group by platform) x),
    'events',         (select coalesce(jsonb_object_agg(event, n), '{}') from (select event, count(*) n from ev where day >= since group by event) x)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_feedback(p_limit int default 100)
returns setof public.feedback language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query select * from public.feedback order by created_at desc limit greatest(1, least(p_limit, 500));
end;
$$;

revoke all on function public.admin_stats(int) from public, anon;
revoke all on function public.admin_feedback(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;
grant execute on function public.admin_feedback(int) to authenticated;
