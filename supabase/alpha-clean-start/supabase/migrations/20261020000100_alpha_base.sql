-- Alpha Clean Start only. Never apply to the existing Quadriamo project.
-- Supabase's own Auth and Storage schemas must already exist; no old app data is imported.
begin;
set local lock_timeout = '5s';

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'ALPHA_OWNER_REQUIRED: run as the project postgres role';
  end if;
  if to_regclass('auth.users') is null or to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('auth.uid()') is null
     or to_regprocedure('auth.role()') is null then
    raise exception 'ALPHA_PLATFORM_NOT_READY: Auth and Storage must be initialized first';
  end if;
  if exists (select 1 from auth.users)
     or exists (select 1 from storage.buckets)
     or exists (select 1 from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind in ('r','p','v','m','f'))
     or to_regnamespace('qsync_private') is not null then
    raise exception 'ALPHA_NOT_EMPTY: use an unused project; preserve existing data';
  end if;
end $$;

lock table auth.users in share row exclusive mode;
lock table storage.buckets in share row exclusive mode;
do $$ begin
  if exists (select 1 from auth.users) or exists (select 1 from storage.buckets) then
    raise exception 'ALPHA_NOT_EMPTY: state appeared during bootstrap';
  end if;
end $$;

create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "own data: select" on public.user_data for select to authenticated
  using ((select auth.uid())=user_id);
revoke all on public.user_data from public,anon,authenticated,service_role;
grant select on public.user_data to authenticated;

-- Only the fields used by the personal profile. No admin/telemetry privileges.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  first_name text check (char_length(first_name)<=80),
  last_name text check (char_length(last_name)<=80),
  monthly_income numeric check (monthly_income between 0 and 10000000),
  currency text check (char_length(currency)<=3),
  goals text[] check (cardinality(goals)<=20),
  cards text[] check (cardinality(cards)<=20),
  invested text check (invested in ('yes','no','want')),
  invest_where text[] check (cardinality(invest_where)<=20),
  shares numeric[] check (cardinality(shares)<=8),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile: select" on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.profiles from public,anon,authenticated,service_role;
grant select,insert,update on public.profiles to authenticated;

create function public.alpha_create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,first_name,last_name)
  values(new.id,left(new.raw_user_meta_data->>'first_name',80),left(new.raw_user_meta_data->>'last_name',80));
  return new;
end $$;
revoke all on function public.alpha_create_profile() from public,anon,authenticated,service_role;
create trigger alpha_create_profile after insert on auth.users
  for each row execute function public.alpha_create_profile();

-- An empty, read-only table keeps the existing Free/Pro client query compatible.
-- No billing Edge Function or Stripe object is part of this Alpha.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
  interval text check (interval in ('month','year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  livemode boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions for select to authenticated
  using ((select auth.uid())=user_id);
revoke all on public.subscriptions from public,anon,authenticated,service_role;
grant select on public.subscriptions to authenticated;

commit;
