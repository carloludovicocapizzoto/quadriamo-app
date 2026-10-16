-- Promemoria del calendario (pagamenti, bollette, rate, scadenze) e preferenze delle notifiche per categoria.
-- I promemoria li calcola il telefono (engine/reminders: orario preferito, ore di silenzio, giorni attivi, tetto giornaliero)
-- e li manda qui: solo l'ora e il nome dell'evento, mai gli importi (l'importo lo aggiunge il telefono quando mostra
-- la notifica). Ogni 10 minuti la funzione send-push (modo "reminders") consegna quelli arrivati.
-- Da eseguire PRIMA di ripubblicare send-push. Rieseguire non cambia niente.

-- interruttori per categoria, per ogni dispositivo iscritto (morning e news esistono già)
alter table public.push_subscriptions add column if not exists reminders boolean not null default true;
alter table public.push_subscriptions add column if not exists nudge boolean not null default true;

create or replace function public.set_push_prefs(p_endpoint text, p_morning boolean, p_news boolean, p_nudge boolean, p_reminders boolean)
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions set morning = p_morning, news = p_news, nudge = p_nudge, reminders = p_reminders
  where endpoint = p_endpoint;
$$;
revoke all on function public.set_push_prefs(text, boolean, boolean, boolean, boolean) from public;
grant execute on function public.set_push_prefs(text, boolean, boolean, boolean, boolean) to anon, authenticated;

create table if not exists public.push_reminders (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fire_at    timestamptz not null,
  day        date not null,                       -- la scadenza a cui si riferisce
  titles     text[] not null check (cardinality(titles) between 1 and 12),
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists push_reminders_due on public.push_reminders (fire_at) where sent_at is null;
alter table public.push_reminders enable row level security;
drop policy if exists "promemoria: li vede chi li ha" on public.push_reminders;
create policy "promemoria: li vede chi li ha" on public.push_reminders for select to authenticated using (user_id = auth.uid());
grant select on public.push_reminders to authenticated;

-- il telefono sostituisce i suoi promemoria futuri con quelli appena calcolati (al massimo 200, nei prossimi 60 giorni)
create or replace function public.replace_reminders(p_rows jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.push_reminders where user_id = auth.uid() and sent_at is null;
  insert into public.push_reminders (user_id, fire_at, day, titles)
  select auth.uid(), (r->>'at')::timestamptz, (r->>'day')::date,
         array(select left(x, 60) from jsonb_array_elements_text(r->'titles') as x limit 12)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  where (r->>'at')::timestamptz between now() - interval '1 hour' and now() + interval '60 days'
    and jsonb_array_length(r->'titles') > 0
  limit 200;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.replace_reminders(jsonb) from public, anon;
grant execute on function public.replace_reminders(jsonb) to authenticated;

-- ogni 10 minuti: consegna (indirizzo e segreto dal programma del mattino, che funziona già); ogni notte via quelli vecchi
select cron.unschedule('quadriamo-reminders') where exists (select 1 from cron.job where jobname = 'quadriamo-reminders');
select cron.schedule('quadriamo-reminders', '*/10 * * * *',
  replace((select command from cron.job where jobname = 'quadriamo-morning-spend'), '"morning"', '"reminders"'))
where exists (select 1 from cron.job where jobname = 'quadriamo-morning-spend');
select cron.unschedule('quadriamo-reminders-cleanup') where exists (select 1 from cron.job where jobname = 'quadriamo-reminders-cleanup');
select cron.schedule('quadriamo-reminders-cleanup', '50 3 * * *', $$ delete from public.push_reminders where fire_at < now() - interval '7 days' $$);
