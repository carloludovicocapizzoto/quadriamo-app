-- Segnalazioni di chi prova la beta: bug o idea, priorità, descrizione, allegati (screenshot e brevi video)
-- e diagnostica automatica (dispositivo, sistema, versione, lingua, ora, ultimi passi del diario tecnico).
-- Il testo può mandarlo chiunque; gli allegati solo chi ha fatto l'accesso (limita gli abusi dell'archivio).
-- Gli allegati stanno nell'archivio privato "reports": li vede solo l'amministratore, e l'area amministratore
-- li cancella dopo 90 giorni. Da eseguire in ogni progetto (produzione e beta). Rieseguire non cambia niente.

create table if not exists public.tester_reports (
  id          uuid primary key,                          -- creato dall'app: serve già per la cartella degli allegati
  created_at  timestamptz not null default now(),
  user_id     uuid default auth.uid(),
  device_id   uuid,
  kind        text not null check (kind in ('bug', 'idea')),
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high', 'blocking')),
  message     text not null check (char_length(message) between 3 and 4000),
  attachments text[] not null default '{}' check (cardinality(attachments) <= 4),
  diagnostics jsonb check (jsonb_typeof(diagnostics) = 'object' and pg_column_size(diagnostics) <= 24000),
  env         text check (length(env) <= 12),
  version     text check (length(version) <= 20),
  status      text not null default 'new' check (status in ('new', 'seen', 'done'))
);
create index if not exists tester_reports_created on public.tester_reports (created_at desc);
alter table public.tester_reports enable row level security;

drop policy if exists "segnalazioni: le manda l'app" on public.tester_reports;
drop policy if exists "segnalazioni: le gestisce l'amministratore" on public.tester_reports;
create policy "segnalazioni: le manda l'app" on public.tester_reports for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = auth.uid())
              and (cardinality(attachments) = 0 or auth.uid() is not null));
create policy "segnalazioni: le gestisce l'amministratore" on public.tester_reports for all to anon, authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert on public.tester_reports to anon, authenticated;
grant select, update, delete on public.tester_reports to anon, authenticated;

-- l'email di chi ha segnalato (se aveva fatto l'accesso), per poterlo ricontattare: solo per l'amministratore
create or replace function public.admin_reports(p_limit int default 300)
returns table (id uuid, created_at timestamptz, kind text, priority text, message text, attachments text[], diagnostics jsonb,
               env text, version text, status text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select r.id, r.created_at, r.kind, r.priority, r.message, r.attachments, r.diagnostics, r.env, r.version, r.status, u.email::text
    from public.tester_reports r left join auth.users u on u.id = r.user_id
    order by r.created_at desc limit greatest(1, least(p_limit, 1000));
end $$;
revoke all on function public.admin_reports(int) from public;
grant execute on function public.admin_reports(int) to anon, authenticated;

-- archivio privato degli allegati: foto fino a 30 MB, video brevi; cartella = l'utente che segnala
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 31457280,
        array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "allegati: li carica chi segnala" on storage.objects;
drop policy if exists "allegati: li vede l'amministratore" on storage.objects;
drop policy if exists "allegati: li cancella l'amministratore" on storage.objects;
create policy "allegati: li carica chi segnala" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "allegati: li vede l'amministratore" on storage.objects for select to anon, authenticated
  using (bucket_id = 'reports' and public.is_admin());
create policy "allegati: li cancella l'amministratore" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'reports' and public.is_admin());
