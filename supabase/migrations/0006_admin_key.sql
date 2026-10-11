-- Accesso all'area amministratore con nome + codice, senza account (scelta di Carlo, 11/10/2026).
-- Il codice non è mai salvato: solo la sua impronta SHA-256. L'area amministratore manda il codice nell'intestazione
-- "x-admin-key" di ogni richiesta; is_admin() lo verifica. Codice di almeno 20 caratteri, casuale.
-- La riga con nome e impronta la prepara la pagina Configurazione dell'area amministratore (il codice resta sul tuo dispositivo).

create table if not exists public.admin_keys (
  key_hash   bytea primary key,
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.admin_keys enable row level security;   -- nessuna policy: dall'app nessuno legge questa tabella

-- il codice inviato con la richiesta (vuoto se manca)
create or replace function public.request_admin_key()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-key', '');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
      or (char_length(public.request_admin_key()) >= 20
          and exists (select 1 from public.admin_keys where key_hash = sha256(convert_to(public.request_admin_key(), 'UTF8'))));
$$;

-- nome di chi è entrato con il codice (per la barra dell'area amministratore)
create or replace function public.admin_name()
returns text language sql stable security definer set search_path = '' as $$
  select name from public.admin_keys
  where char_length(public.request_admin_key()) >= 20 and key_hash = sha256(convert_to(public.request_admin_key(), 'UTF8'));
$$;

-- con il codice si entra senza account: le funzioni dell'area amministratore (che controllano is_admin) diventano
-- chiamabili anche senza accesso, ma rispondono solo a chi ha un codice valido
grant execute on function public.request_admin_key() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.admin_name() to anon, authenticated;
grant execute on function public.admin_stats(int) to anon;
grant execute on function public.admin_feedback(int) to anon;
grant execute on function public.admin_devices(int) to anon;
grant execute on function public.admin_accounts() to anon;
grant execute on function public.admin_push_list() to anon;
grant execute on function public.admin_profile_stats() to anon;
grant execute on function public.admin_reminder_active() to anon;
grant execute on function public.site_feedback_ready() to anon;
