-- Errori dell'app sui dispositivi degli utenti: si vedono nell'area admin (pannello Errori), nessun servizio esterno.
-- Solo dati tecnici: messaggio (le email vengono oscurate dall'app), traccia, schermata, versione, tipo di dispositivo.
-- Nessun importo, nessun movimento, nessun identificativo dell'utente. Chiunque può scrivere (anche senza account),
-- legge solo l'amministratore. Si tengono 30 giorni. Rieseguire non cambia niente.
create table if not exists public.client_errors (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  message  text not null check (length(message) <= 300),
  stack    text check (length(stack) <= 2000),
  route    text check (length(route) <= 80),
  version  text check (length(version) <= 20),
  platform text check (length(platform) <= 40)
);
create index if not exists client_errors_at on public.client_errors (at desc);
alter table public.client_errors enable row level security;
drop policy if exists "errori: li manda l'app" on public.client_errors;
drop policy if exists "errori: li legge l'amministratore" on public.client_errors;
drop policy if exists "errori: li cancella l'amministratore" on public.client_errors;
create policy "errori: li manda l'app" on public.client_errors for insert to anon, authenticated with check (true);
create policy "errori: li legge l'amministratore" on public.client_errors for select to authenticated using (public.is_admin());
create policy "errori: li cancella l'amministratore" on public.client_errors for delete to authenticated using (public.is_admin());
grant insert on public.client_errors to anon, authenticated;
grant select, delete on public.client_errors to authenticated;

-- pulizia: ogni notte via gli errori più vecchi di 30 giorni
select cron.unschedule('quadriamo-client-errors-cleanup') where exists (select 1 from cron.job where jobname = 'quadriamo-client-errors-cleanup');
select cron.schedule('quadriamo-client-errors-cleanup', '30 3 * * *', $$ delete from public.client_errors where at < now() - interval '30 days' $$);
