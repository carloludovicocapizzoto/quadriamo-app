-- Quadriamo: un documento JSON per utente con tutti i suoi dati (impostazioni + movimenti).
-- Da eseguire una volta in Supabase: SQL Editor -> New query -> incolla -> Run.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Sicurezza: ogni utente vede e modifica solo la propria riga.
alter table public.user_data enable row level security;

drop policy if exists "own data: select" on public.user_data;
drop policy if exists "own data: insert" on public.user_data;
drop policy if exists "own data: update" on public.user_data;
drop policy if exists "own data: delete" on public.user_data;
create policy "own data: select" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "own data: insert" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own data: update" on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own data: delete" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- Cancellazione dell'account dall'app (GDPR): elimina l'utente e, a cascata, i suoi dati.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
