-- Dati sensibili riservati all'utente e ricerca solo anonima (11/10/2026).
-- 1. Entrate, obiettivi, carte, investimenti e divisione NON stanno più nella tabella profiles: restano nei dati
--    personali dell'utente (user_data, leggibili solo dal suo account). Nella tabella profiles restano nome e cognome.
-- 2. Chi sceglie di partecipare alla ricerca invia una scheda ANONIMA: niente account, nome o email, entrate solo per
--    fascia. È legata solo a un codice casuale del suo dispositivo, che serve a lui per aggiornarla o ritirarla.
-- 3. L'amministratore vede solo totali, e solo quando le schede sono almeno 5 (con meno, una persona sarebbe riconoscibile).

alter table public.profiles
  drop column if exists monthly_income, drop column if exists currency, drop column if exists goals,
  drop column if exists cards, drop column if exists invested, drop column if exists invest_where, drop column if exists shares;

create table if not exists public.research_answers (
  token        uuid primary key,                       -- casuale, generato sul dispositivo: non identifica la persona
  income_band  text check (income_band in ('lt1000', '1000-1500', '1500-2000', '2000-3000', 'ge3000')),
  goals        text[] check (cardinality(goals) <= 20),
  cards        text[] check (cardinality(cards) <= 20),
  invested     text check (invested in ('yes', 'no', 'want')),
  invest_where text[] check (cardinality(invest_where) <= 20),
  shares       numeric[] check (cardinality(shares) <= 8),
  updated_at   timestamptz not null default now()
);
alter table public.research_answers enable row level security;   -- nessuna policy: si passa solo dalle funzioni qui sotto

create or replace function public.submit_research(p_token uuid, p_income_band text, p_goals text[], p_cards text[],
                                                  p_invested text, p_where text[], p_shares numeric[])
returns void language sql security definer set search_path = '' as $$
  insert into public.research_answers (token, income_band, goals, cards, invested, invest_where, shares, updated_at)
  values (p_token, p_income_band, p_goals, p_cards, p_invested, p_where, p_shares, now())
  on conflict (token) do update set income_band = excluded.income_band, goals = excluded.goals, cards = excluded.cards,
    invested = excluded.invested, invest_where = excluded.invest_where, shares = excluded.shares, updated_at = now();
$$;
create or replace function public.remove_research(p_token uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.research_answers where token = p_token;
$$;
revoke all on function public.submit_research(uuid, text, text[], text[], text, text[], numeric[]) from public;
revoke all on function public.remove_research(uuid) from public;
grant execute on function public.submit_research(uuid, text, text[], text[], text, text[], numeric[]) to anon, authenticated;
grant execute on function public.remove_research(uuid) to anon, authenticated;

-- statistiche della ricerca: solo totali, solo da 5 schede in su
drop function if exists public.admin_profile_stats();
create or replace function public.admin_research_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n bigint; result jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select count(*) into n from public.research_answers;
  if n < 5 then return jsonb_build_object('answers', n, 'min', 5); end if;
  with r as (select * from public.research_answers)
  select jsonb_build_object(
    'answers', n, 'min', 5,
    'income_bands', (select coalesce(jsonb_object_agg(income_band, c), '{}') from (select income_band, count(*) c from r where income_band is not null group by 1) x),
    'goals',        (select coalesce(jsonb_object_agg(v, c), '{}') from (select unnest(goals) v, count(*) c from r group by 1) x),
    'cards',        (select coalesce(jsonb_object_agg(v, c), '{}') from (select unnest(cards) v, count(*) c from r group by 1) x),
    'invested',     (select coalesce(jsonb_object_agg(invested, c), '{}') from (select invested, count(*) c from r where invested is not null group by 1) x),
    'invest_where', (select coalesce(jsonb_object_agg(v, c), '{}') from (select unnest(invest_where) v, count(*) c from r group by 1) x),
    'shares_avg',   (select jsonb_agg(round(a, 1) order by i) from (
                       select i, avg(r.shares[i]) a from r, generate_subscripts(r.shares, 1) i where cardinality(r.shares) = 4 group by i) x),
    'shares_default', (select count(*) from r where shares = '{55,20,15,10}'::numeric[]),
    'shares_custom',  (select count(*) from r where cardinality(shares) = 4 and shares <> '{55,20,15,10}'::numeric[])
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_research_stats() from public;
grant execute on function public.admin_research_stats() to anon, authenticated;

-- elenco account: solo dati dell'account (niente più "profilo compilato")
drop function if exists public.admin_accounts();
create or replace function public.admin_accounts()
returns table (email text, first_name text, last_name text, created_at timestamptz, last_sign_in_at timestamptz,
               has_push boolean, feedback_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
  select u.email::text, p.first_name, p.last_name, u.created_at, u.last_sign_in_at,
         exists (select 1 from public.push_subscriptions s where s.user_id = u.id),
         (select count(*) from public.feedback f where f.user_id = u.id)
  from auth.users u left join public.profiles p on p.user_id = u.id order by u.created_at desc;
end;
$$;
revoke all on function public.admin_accounts() from public;
grant execute on function public.admin_accounts() to anon, authenticated;
