-- Errori più facili da ricostruire: con ogni errore arrivano anche l'ambiente (production, beta), il commit del codice
-- e il diario tecnico, cioè gli ultimi passi sul dispositivo (schermate, tipi di azione, rallentamenti, rete).
-- Mai importi, testi o nomi. L'app manda questi campi solo se ci sono: prima di questo script gli errori arrivano lo stesso.
-- Da eseguire in ogni progetto (produzione e beta). Rieseguire non cambia niente.
alter table public.client_errors add column if not exists env    text check (length(env) <= 12);
alter table public.client_errors add column if not exists commit text check (length(commit) <= 12);
alter table public.client_errors add column if not exists trail  jsonb check (jsonb_typeof(trail) = 'array' and pg_column_size(trail) <= 16000);
