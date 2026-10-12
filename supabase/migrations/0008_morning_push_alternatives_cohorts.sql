-- 12/10/2026 — notifica del mattino, domanda ai tester, ritorno dopo 7 giorni.
-- 1. Notifica del mattino ("Oggi puoi spendere…"): il server manda solo la "sveglia"; il numero lo calcola il telefono con i
--    dati che ha già, quindi nessun importo passa dal server. Qui si ricorda solo chi l'ha attivata.
-- 2. Feedback: "Se non ci fosse Quadriamo, cosa useresti?".
-- 3. Dashboard: ritorno dopo 7 giorni, settimana per settimana (coorti dei nuovi dispositivi).

alter table public.push_subscriptions add column if not exists morning boolean not null default false;

create or replace function public.set_morning_push(p_endpoint text, p_on boolean)
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions set morning = p_on where endpoint = p_endpoint;
$$;
revoke all on function public.set_morning_push(text, boolean) from public;
grant execute on function public.set_morning_push(text, boolean) to anon, authenticated;

alter table public.feedback add column if not exists alternative text
  check (alternative in ('nothing', 'spreadsheet', 'notes', 'bank_app', 'other_app'));
alter table public.feedback add column if not exists alternative_other text check (char_length(alternative_other) <= 120);

-- coorti settimanali: dispositivi nuovi in quella settimana e quanti sono tornati dopo almeno 7 giorni
create or replace function public.admin_cohorts(p_weeks int default 8)
returns table (week date, new_devices bigint, back_7 bigint, ready boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
  with firsts as (select device_id, min(day) as first_day from public.usage_events group by device_id),
  w as (select date_trunc('week', f.first_day)::date as wk, f.device_id, f.first_day,
               exists (select 1 from public.usage_events e where e.device_id = f.device_id and e.day >= f.first_day + 7) as back
        from firsts f)
  select wk, count(*), count(*) filter (where back),
         -- la settimana "conta" solo quando tutti i suoi dispositivi hanno avuto almeno 7 giorni per tornare
         (wk + 13) <= (now() at time zone 'utc')::date
  from w where wk >= date_trunc('week', (now() at time zone 'utc')::date)::date - 7 * greatest(1, least(p_weeks, 52))
  group by wk order by wk;
end;
$$;
revoke all on function public.admin_cohorts(int) from public;
grant execute on function public.admin_cohorts(int) to anon, authenticated;

-- risposte alla domanda sulle alternative (solo totali)
create or replace function public.admin_alternatives()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select coalesce(jsonb_object_agg(alternative, n), '{}') into result
  from (select alternative, count(*) n from public.feedback where alternative is not null group by 1) x;
  return result;
end;
$$;
revoke all on function public.admin_alternatives() from public;
grant execute on function public.admin_alternatives() to anon, authenticated;
