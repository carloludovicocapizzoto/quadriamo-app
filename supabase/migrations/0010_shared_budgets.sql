-- Budget comune (di coppia o tra coinquilini), accanto ai budget personali che restano privati.
-- Chi ne fa parte vede e modifica solo i budget comuni a cui partecipa. Si entra con un codice d'invito (valido 7 giorni).
-- La divisione predefinita la scelgono gli utenti (metà e metà, in proporzione alle entrate, quote personalizzate) e ogni
-- spesa può averne una sua (es. "la pago solo io").

create table if not exists public.shared_budgets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  currency    text not null default 'EUR' check (char_length(currency) = 3),
  split_mode  text not null default 'equal' check (split_mode in ('equal', 'income', 'custom')),
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.shared_members (
  budget_id    uuid not null references public.shared_budgets(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  income       numeric check (income >= 0 and income < 10000000),   -- solo per "in proporzione alle entrate", lo vede chi è nel budget
  share        numeric check (share >= 0 and share <= 100),          -- solo per "quote personalizzate"
  joined_at    timestamptz not null default now(),
  primary key (budget_id, user_id)
);

create table if not exists public.shared_invites (
  code        text primary key,
  budget_id   uuid not null references public.shared_budgets(id) on delete cascade,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '7 days'
);

create table if not exists public.shared_expenses (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references public.shared_budgets(id) on delete cascade,
  paid_by     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  description text not null check (char_length(description) between 1 and 120),
  amount      numeric not null check (amount > 0 and amount < 10000000),
  category    text check (char_length(category) <= 40),
  split       jsonb,   -- null = divisione del budget; {"mode": "equal" | "income" | "payer" | "custom", "shares": {"<user_id>": percentuale}}
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shared_expenses_budget on public.shared_expenses (budget_id, date);

create table if not exists public.shared_settlements (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references public.shared_budgets(id) on delete cascade,
  from_user   uuid not null references auth.users(id) on delete cascade,
  to_user     uuid not null references auth.users(id) on delete cascade,
  amount      numeric not null check (amount > 0 and amount < 10000000),
  date        date not null default (now() at time zone 'utc')::date,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- chi fa parte di un budget comune
create or replace function public.is_shared_member(p_budget uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_members where budget_id = p_budget and user_id = auth.uid());
$$;
revoke all on function public.is_shared_member(uuid) from public, anon;
grant execute on function public.is_shared_member(uuid) to authenticated;

alter table public.shared_budgets enable row level security;
alter table public.shared_members enable row level security;
alter table public.shared_invites enable row level security;     -- nessuna policy: si passa dalle funzioni
alter table public.shared_expenses enable row level security;
alter table public.shared_settlements enable row level security;

drop policy if exists "members read budget" on public.shared_budgets;
drop policy if exists "members update budget" on public.shared_budgets;
drop policy if exists "creator deletes budget" on public.shared_budgets;
create policy "members read budget" on public.shared_budgets for select to authenticated using (public.is_shared_member(id));
create policy "members update budget" on public.shared_budgets for update to authenticated using (public.is_shared_member(id)) with check (public.is_shared_member(id));
create policy "creator deletes budget" on public.shared_budgets for delete to authenticated using (created_by = (select auth.uid()));

drop policy if exists "members read members" on public.shared_members;
drop policy if exists "members update members" on public.shared_members;
drop policy if exists "member leaves" on public.shared_members;
create policy "members read members" on public.shared_members for select to authenticated using (public.is_shared_member(budget_id));
create policy "members update members" on public.shared_members for update to authenticated
  using (public.is_shared_member(budget_id)) with check (public.is_shared_member(budget_id));
create policy "member leaves" on public.shared_members for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members use expenses" on public.shared_expenses;
create policy "members use expenses" on public.shared_expenses for all to authenticated
  using (public.is_shared_member(budget_id))
  with check (public.is_shared_member(budget_id) and exists (select 1 from public.shared_members m where m.budget_id = shared_expenses.budget_id and m.user_id = shared_expenses.paid_by));

drop policy if exists "members use settlements" on public.shared_settlements;
create policy "members use settlements" on public.shared_settlements for all to authenticated
  using (public.is_shared_member(budget_id)) with check (public.is_shared_member(budget_id));

revoke all on public.shared_budgets, public.shared_members, public.shared_invites, public.shared_expenses, public.shared_settlements from anon;
grant select, update, delete on public.shared_budgets to authenticated;
grant select, update, delete on public.shared_members to authenticated;
grant select, insert, update, delete on public.shared_expenses to authenticated;
grant select, insert, update, delete on public.shared_settlements to authenticated;

-- crea un budget comune (chi lo crea ne fa subito parte)
create or replace function public.create_shared_budget(p_name text, p_currency text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.shared_budgets (name, currency, created_by) values (p_name, upper(p_currency), auth.uid()) returning id into b;
  insert into public.shared_members (budget_id, user_id, display_name) values (b, auth.uid(), p_display_name);
  return b;
end;
$$;

-- codice d'invito (8 caratteri, valido 7 giorni), solo per chi è nel budget
create or replace function public.create_shared_invite(p_budget uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.is_shared_member(p_budget) then raise exception 'not allowed'; end if;
  c := upper(substr(translate(encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'base64'), '+/=0O1IL', ''), 1, 8));
  insert into public.shared_invites (code, budget_id) values (c, p_budget);
  return c;
end;
$$;

-- entra con il codice (massimo 6 persone per budget)
create or replace function public.join_shared_budget(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select budget_id into b from public.shared_invites where code = upper(trim(p_code)) and expires_at > now();
  if b is null then raise exception 'invalid code'; end if;
  if (select count(*) from public.shared_members where budget_id = b) >= 6 then raise exception 'budget full'; end if;
  insert into public.shared_members (budget_id, user_id, display_name) values (b, auth.uid(), p_display_name)
  on conflict (budget_id, user_id) do nothing;
  return b;
end;
$$;

revoke all on function public.create_shared_budget(text, text, text) from public, anon;
revoke all on function public.create_shared_invite(uuid) from public, anon;
revoke all on function public.join_shared_budget(text, text) from public, anon;
grant execute on function public.create_shared_budget(text, text, text) to authenticated;
grant execute on function public.create_shared_invite(uuid) to authenticated;
grant execute on function public.join_shared_budget(text, text) to authenticated;
