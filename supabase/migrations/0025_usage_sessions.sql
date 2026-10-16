-- Come si usa l'app, per migliorarla: una riga per sessione (dall'apertura a quando l'app va in secondo piano),
-- SOLO con il consenso alle statistiche anonime. Contiene: secondi per schermata, il percorso tra le schermate,
-- quante volte è stato usato ogni tipo di azione, rallentamenti, errori, l'ultima schermata prima di uscire.
-- Mai importi, testi, categorie o nomi; il dispositivo è il codice casuale già usato dalle statistiche.
-- L'amministratore vede solo totali, e solo per le voci usate da almeno 5 dispositivi (admin_usage).
-- Si tengono 180 giorni. Da eseguire in ogni progetto (produzione e beta). Rieseguire non cambia niente.

create table if not exists public.usage_sessions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  day         date not null default ((now() at time zone 'utc')::date),
  session_id  uuid not null,                  -- una sessione può arrivare in più pezzi (l'app torna in primo piano)
  device_id   uuid not null,
  seconds     int  not null check (seconds between 0 and 86400),
  screens     jsonb not null check (jsonb_typeof(screens) = 'object' and pg_column_size(screens) <= 4000),  -- { "#/analysis/month": 42 }
  path        jsonb not null check (jsonb_typeof(path) = 'array' and pg_column_size(path) <= 4000),       -- ["#/", "#/analysis/month", …]
  actions     jsonb not null check (jsonb_typeof(actions) = 'object' and pg_column_size(actions) <= 2000), -- { "addTx": 2 }
  slow        int  not null default 0 check (slow between 0 and 1000),
  errors      int  not null default 0 check (errors between 0 and 1000),
  last_screen text check (length(last_screen) <= 80),
  env         text check (length(env) <= 12),
  version     text check (length(version) <= 20),
  platform    text check (length(platform) <= 16),
  installed   boolean
);
create index if not exists usage_sessions_day on public.usage_sessions (day);
alter table public.usage_sessions enable row level security;
drop policy if exists "sessioni: le manda l'app" on public.usage_sessions;
create policy "sessioni: le manda l'app" on public.usage_sessions for insert to anon, authenticated with check (true);
grant insert on public.usage_sessions to anon, authenticated;

select cron.unschedule('quadriamo-usage-sessions-cleanup') where exists (select 1 from cron.job where jobname = 'quadriamo-usage-sessions-cleanup');
select cron.schedule('quadriamo-usage-sessions-cleanup', '40 3 * * *', $$ delete from public.usage_sessions where day < (now() at time zone 'utc')::date - 180 $$);

-- Totali per l'area amministratore. Ogni voce compare solo se l'hanno usata almeno 5 dispositivi diversi.
create or replace function public.admin_usage(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  since date := (now() at time zone 'utc')::date - greatest(1, least(p_days, 180)) + 1;
  devices int;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select count(distinct device_id) into devices from public.usage_sessions where day >= since;
  if devices < 5 then return jsonb_build_object('devices', devices, 'min', 5); end if;
  return (
    with s as (   -- i pezzi della stessa sessione diventano una sessione sola
      select session_id, min(device_id::text) device_id, sum(seconds) seconds, sum(slow) slow, sum(errors) errors,
             (array_agg(last_screen order by created_at desc))[1] last_screen
      from public.usage_sessions where day >= since group by session_id
    ),
    scr as (
      select u.device_id, u.session_id, k screen, v::int secs
      from public.usage_sessions u, jsonb_each_text(u.screens) as e(k, v) where u.day >= since
    ),
    steps as (
      select u.device_id, p.a, p.b from public.usage_sessions u,
      lateral (select x.value #>> '{}' a, lead(x.value #>> '{}') over (order by x.ord) b
               from jsonb_array_elements(u.path) with ordinality x(value, ord)) p
      where u.day >= since and p.b is not null and p.a <> p.b
    ),
    act as (
      select u.device_id, k action, v::int n from public.usage_sessions u, jsonb_each_text(u.actions) as e(k, v) where u.day >= since
    )
    select jsonb_build_object(
      'devices', devices, 'min', 5,
      'sessions', (select count(*) from s),
      'median_seconds', (select percentile_cont(0.5) within group (order by seconds) from s),
      'slow_share', (select round(avg((slow > 0)::int) * 100) from s),
      'error_share', (select round(avg((errors > 0)::int) * 100) from s),
      'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'sessions', n) order by d), '[]')
                from (select day d, count(distinct session_id) n from public.usage_sessions where day >= since group by day) x),
      'screens', (select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'devices', dv, 'sessions', ss, 'avg_seconds', av) order by ss desc), '[]')
                  from (select screen, count(distinct device_id) dv, count(distinct session_id) ss, round(avg(secs)) av
                        from scr group by screen having count(distinct device_id) >= 5) x),
      'exits', (select coalesce(jsonb_agg(jsonb_build_object('screen', last_screen, 'sessions', n) order by n desc), '[]')
                from (select last_screen, count(*) n from s where last_screen is not null
                      group by last_screen having count(distinct device_id) >= 5) x),
      'paths', (select coalesce(jsonb_agg(jsonb_build_object('from', a, 'to', b, 'times', n) order by n desc), '[]')
                from (select a, b, count(*) n from steps group by a, b having count(distinct device_id) >= 5 order by n desc limit 15) x),
      'actions', (select coalesce(jsonb_agg(jsonb_build_object('action', action, 'devices', dv, 'times', n) order by n), '[]')
                  from (select action, count(distinct device_id) dv, sum(n) n from act group by action having count(distinct device_id) >= 5) x)
    )
  );
end $$;
revoke all on function public.admin_usage(int) from public;
grant execute on function public.admin_usage(int) to anon, authenticated;  -- anche con nome e codice (0006); is_admin() decide
