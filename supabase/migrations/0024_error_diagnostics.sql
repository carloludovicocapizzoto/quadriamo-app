-- Errori più facili da ricostruire: con ogni errore arrivano anche l'ambiente (production, beta), il commit del codice
-- e il diario tecnico, cioè gli ultimi passi sul dispositivo (schermate, tipi di azione, rallentamenti, rete).
-- Mai importi, testi o nomi. L'app manda questi campi solo se ci sono: prima di questo script gli errori arrivano lo stesso.
-- Da eseguire in ogni progetto (produzione e beta). Rieseguire non cambia niente.
alter table public.client_errors add column if not exists env    text check (length(env) <= 12);
alter table public.client_errors add column if not exists commit text check (length(commit) <= 12);
alter table public.client_errors add column if not exists trail  jsonb check (jsonb_typeof(trail) = 'array' and pg_column_size(trail) <= 16000);

-- chi entra nell'area amministratore con nome e codice (0006) usa il ruolo anon: anche lui deve poter leggere e
-- cancellare gli errori (prima solo con l'account). is_admin() resta il controllo: senza codice valido non si vede niente.
drop policy if exists "errori: li legge l'amministratore" on public.client_errors;
drop policy if exists "errori: li cancella l'amministratore" on public.client_errors;
create policy "errori: li legge l'amministratore" on public.client_errors for select to anon, authenticated using (public.is_admin());
create policy "errori: li cancella l'amministratore" on public.client_errors for delete to anon, authenticated using (public.is_admin());
grant select, delete on public.client_errors to anon;
