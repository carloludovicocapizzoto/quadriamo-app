-- Foto profilo: uno spazio privato (bucket "avatars"). Ognuno vede e cambia solo la propria foto,
-- salvata in avatars/<id utente>/avatar.webp. Nessun altro può leggerla: né gli altri utenti né chi condivide un budget.
-- La foto arriva già ridotta dal telefono (256x256), quindi il limite di 1 MB non si raggiunge mai.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar: leggo la mia" on storage.objects;
drop policy if exists "avatar: carico la mia" on storage.objects;
drop policy if exists "avatar: cambio la mia" on storage.objects;
drop policy if exists "avatar: cancello la mia" on storage.objects;

create policy "avatar: leggo la mia" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: carico la mia" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: cambio la mia" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: cancello la mia" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
