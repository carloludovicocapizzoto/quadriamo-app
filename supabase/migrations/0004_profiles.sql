-- Quadriamo: profilo dell'utente registrato. Nome e cognome dalla registrazione; il resto è facoltativo
-- (entrate mensili, obiettivi, carte usate, investimenti, divisione delle entrate che vuole applicare).
-- Ognuno vede e modifica solo il proprio profilo; l'amministratore vede solo numeri aggregati.

create table if not exists public.profiles (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  first_name      text check (char_length(first_name) <= 80),
  last_name       text check (char_length(last_name) <= 80),
  monthly_income  numeric check (monthly_income between 0 and 10000000),
  currency        text check (char_length(currency) <= 3),
  goals           text[] check (cardinality(goals) <= 20),
  cards           text[] check (cardinality(cards) <= 20),
  invested        text check (invested in ('yes', 'no', 'want')),
  invest_where    text[] check (cardinality(invest_where) <= 20),
  shares          numeric[] check (cardinality(shares) <= 8),     -- percentuali dei quattro portafogli, es. {55,20,15,10}
  updated_at      timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile: select" on public.profiles;
drop policy if exists "own profile: insert" on public.profiles;
drop policy if exists "own profile: update" on public.profiles;
create policy "own profile: select" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- alla registrazione nasce il profilo con nome e cognome scritti nel modulo
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, first_name, last_name)
  values (new.id, left(new.raw_user_meta_data ->> 'first_name', 80), left(new.raw_user_meta_data ->> 'last_name', 80))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- per l'area amministratore ----------
-- elenco account, ora con nome e cognome (nessun dato economico per persona)
drop function if exists public.admin_accounts();
create or replace function public.admin_accounts()
returns table (email text, first_name text, last_name text, created_at timestamptz, last_sign_in_at timestamptz,
               profile_done boolean, has_push boolean, feedback_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
  select u.email::text, p.first_name, p.last_name, u.created_at, u.last_sign_in_at,
         coalesce(p.monthly_income is not null or cardinality(p.goals) > 0 or p.invested is not null, false),
         exists (select 1 from public.push_subscriptions s where s.user_id = u.id),
         (select count(*) from public.feedback f where f.user_id = u.id)
  from auth.users u left join public.profiles p on p.user_id = u.id order by u.created_at desc;
end;
$$;

-- profili in forma aggregata, per la ricerca: fasce di entrate, obiettivi, carte, investimenti, divisione media
create or replace function public.admin_profile_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  with p as (select * from public.profiles)
  select jsonb_build_object(
    'profiles',   (select count(*) from p),
    'completed',  (select count(*) from p where monthly_income is not null or cardinality(goals) > 0 or invested is not null),
    'with_income',(select count(*) from p where monthly_income is not null),
    'income_median', (select percentile_cont(0.5) within group (order by monthly_income) from p where monthly_income is not null),
    'income_avg', (select round(avg(monthly_income)) from p where monthly_income is not null),
    'income_bands', (select coalesce(jsonb_object_agg(band, n), '{}') from (
        select case when monthly_income < 1000 then '1 · meno di 1.000' when monthly_income < 1500 then '2 · 1.000–1.500'
                    when monthly_income < 2000 then '3 · 1.500–2.000' when monthly_income < 3000 then '4 · 2.000–3.000'
                    else '5 · 3.000 e oltre' end band, count(*) n
        from p where monthly_income is not null group by 1) x),
    'goals',      (select coalesce(jsonb_object_agg(v, n), '{}') from (select unnest(goals) v, count(*) n from p group by 1) x),
    'cards',      (select coalesce(jsonb_object_agg(v, n), '{}') from (select unnest(cards) v, count(*) n from p group by 1) x),
    'invested',   (select coalesce(jsonb_object_agg(invested, n), '{}') from (select invested, count(*) n from p where invested is not null group by 1) x),
    'invest_where', (select coalesce(jsonb_object_agg(v, n), '{}') from (select unnest(invest_where) v, count(*) n from p group by 1) x),
    'shares_avg', (select jsonb_agg(round(a, 1) order by i) from (
        select i, avg(s[i]) a from p, generate_subscripts(p.shares, 1) i, lateral (select p.shares s) z
        where cardinality(p.shares) = 4 group by i) x),
    'shares_default', (select count(*) from p where shares = '{55,20,15,10}'::numeric[]),
    'shares_custom',  (select count(*) from p where cardinality(shares) = 4 and shares <> '{55,20,15,10}'::numeric[])
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_accounts() from public, anon;
revoke all on function public.admin_profile_stats() from public, anon;
grant execute on function public.admin_accounts() to authenticated;
grant execute on function public.admin_profile_stats() to authenticated;
