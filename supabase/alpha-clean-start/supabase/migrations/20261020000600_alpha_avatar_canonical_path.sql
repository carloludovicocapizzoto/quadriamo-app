-- Incremental Alpha hardening; do not edit the five deployed base migrations.
begin;
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id='avatars' and name='avatars' and not public
      and file_size_limit=1048576
      and allowed_mime_types=array['image/webp','image/jpeg','image/png']::text[]
  ) then
    raise exception 'ALPHA_AVATAR_BUCKET_CONFIG_MISMATCH';
  end if;

  if not exists (select 1 from pg_catalog.pg_class where oid='storage.objects'::regclass and relrowsecurity)
     or not exists (select 1 from pg_catalog.pg_class where oid='storage.buckets'::regclass and relrowsecurity) then
    raise exception 'ALPHA_AVATAR_RLS_REQUIRED';
  end if;

  if (select count(*) from pg_catalog.pg_policies where schemaname='storage' and tablename='objects') <> 4
     or exists (
       select 1 from pg_catalog.pg_policies p
       where p.schemaname='storage' and p.tablename in ('objects','buckets')
         and not (
           p.tablename='objects' and p.permissive='PERMISSIVE'
           and p.roles=array['authenticated']::name[]
           and ((p.policyname='avatar: leggo la mia' and p.cmd='SELECT')
             or (p.policyname='avatar: carico la mia' and p.cmd='INSERT')
             or (p.policyname='avatar: cambio la mia' and p.cmd='UPDATE')
             or (p.policyname='avatar: cancello la mia' and p.cmd='DELETE'))
         )
     ) then
    raise exception 'ALPHA_AVATAR_UNEXPECTED_STORAGE_POLICY';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id='avatars'
      and name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]webp$'
  ) then
    raise exception 'ALPHA_AVATAR_NONCANONICAL_OBJECTS_PRESENT';
  end if;
end
$$;

drop policy if exists "avatar: leggo la mia" on storage.objects;
drop policy if exists "avatar: carico la mia" on storage.objects;
drop policy if exists "avatar: cambio la mia" on storage.objects;
drop policy if exists "avatar: cancello la mia" on storage.objects;

create policy "avatar: leggo la mia" on storage.objects for select to authenticated
  using (bucket_id='avatars' and name=((auth.uid())::text || '/avatar.webp'));
create policy "avatar: carico la mia" on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and name=((auth.uid())::text || '/avatar.webp'));
create policy "avatar: cambio la mia" on storage.objects for update to authenticated
  using (bucket_id='avatars' and name=((auth.uid())::text || '/avatar.webp'))
  with check (bucket_id='avatars' and name=((auth.uid())::text || '/avatar.webp'));
create policy "avatar: cancello la mia" on storage.objects for delete to authenticated
  using (bucket_id='avatars' and name=((auth.uid())::text || '/avatar.webp'));
commit;
