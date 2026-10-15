-- Calendario degli eventi economici per il widget della Home (riunioni BCE e Fed, dati ISTAT, ...).
-- Nessun servizio esterno: le date le inserisce l'amministratore, dalle fonti ufficiali. Tutti leggono, scrive solo l'admin.
-- Esempio: insert into public.econ_events (day, title_it, title_en, url) values ('2026-10-29', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'https://www.ecb.europa.eu');
create table if not exists public.econ_events (
  id       bigint generated always as identity primary key,
  day      date not null,
  title_it text not null,
  title_en text not null,
  title_fr text,
  title_es text,
  url      text
);
create index if not exists econ_events_day on public.econ_events (day);
alter table public.econ_events enable row level security;
drop policy if exists "eventi: li legge chiunque" on public.econ_events;
drop policy if exists "eventi: li gestisce l'amministratore" on public.econ_events;
create policy "eventi: li legge chiunque" on public.econ_events for select to anon, authenticated using (true);
create policy "eventi: li gestisce l'amministratore" on public.econ_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.econ_events to anon, authenticated;
grant insert, update, delete on public.econ_events to authenticated;
