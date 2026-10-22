-- Read-only inventory and fail-closed verification for Alpha Storage hardening.
-- Run as postgres after migration 20261020000600. No rows, secrets, or object metadata are selected.
begin read only;

select 'POLICY' as item,schemaname,tablename,policyname,permissive,
  array_to_string(roles,',') as roles,cmd,coalesce(qual,'<none>') as using_expression,
  coalesce(with_check,'<none>') as check_expression
from pg_catalog.pg_policies
where schemaname='storage' and tablename in ('objects','buckets')
order by tablename,policyname;

select 'ROLE' as item,rolname,rolsuper,rolbypassrls,
  pg_has_role('anon',rolname,'MEMBER') as anon_is_member,
  pg_has_role('authenticated',rolname,'MEMBER') as authenticated_is_member
from pg_catalog.pg_roles
where rolname in ('anon','authenticated','service_role')
order by rolname;

select 'GRANT' as item,table_name,grantee,privilege_type,is_grantable
from information_schema.role_table_grants
where table_schema='storage' and table_name in ('objects','buckets')
order by table_name,grantee,privilege_type;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or (select count(*) from supabase_migrations.schema_migrations)<>6
     or (select count(*) from supabase_migrations.schema_migrations where (version,name) in (
       ('20261020000100','alpha_base'),
       ('20261020000200','revisioned_sync'),
       ('20261020000300','alpha_clean_start_sync_limits'),
       ('20261020000400','avatars'),
       ('20261020000500','alpha_data_api_gate'),
       ('20261020000600','alpha_avatar_canonical_path')
     ))<>6 then
    raise exception 'ALPHA_STORAGE_MIGRATION_HISTORY';
  end if;

  if not exists(select 1 from pg_catalog.pg_class where oid='storage.objects'::regclass and relrowsecurity)
     or not exists(select 1 from pg_catalog.pg_class where oid='storage.buckets'::regclass and relrowsecurity)
     or exists(select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
     or pg_has_role('anon','authenticated','MEMBER')
     or pg_has_role('anon','service_role','MEMBER')
     or pg_has_role('authenticated','service_role','MEMBER')
     or exists(select 1 from pg_catalog.pg_roles r
       where r.rolname not in ('anon','authenticated') and (r.rolsuper or r.rolbypassrls)
         and (pg_has_role('anon',r.rolname,'MEMBER') or pg_has_role('authenticated',r.rolname,'MEMBER'))) then
    raise exception 'ALPHA_STORAGE_RLS_OR_ROLE_CONFIGURATION';
  end if;

  if (select count(*) from pg_catalog.pg_policies where schemaname='storage' and tablename='objects')<>4
     or exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='buckets') then
    raise exception 'ALPHA_STORAGE_UNEXPECTED_POLICY_INVENTORY';
  end if;

  if exists (
    with expected(policyname,cmd,qual,with_check) as (values
      ('avatar: leggo la mia','SELECT',
       '((bucket_id = ''avatars''::text) AND (name = ((auth.uid())::text || ''/avatar.webp''::text)))',null::text),
      ('avatar: carico la mia','INSERT',null::text,
       '((bucket_id = ''avatars''::text) AND (name = ((auth.uid())::text || ''/avatar.webp''::text)))'),
      ('avatar: cambio la mia','UPDATE',
       '((bucket_id = ''avatars''::text) AND (name = ((auth.uid())::text || ''/avatar.webp''::text)))',
       '((bucket_id = ''avatars''::text) AND (name = ((auth.uid())::text || ''/avatar.webp''::text)))'),
      ('avatar: cancello la mia','DELETE',
       '((bucket_id = ''avatars''::text) AND (name = ((auth.uid())::text || ''/avatar.webp''::text)))',null::text)
    )
    select 1 from expected e left join pg_catalog.pg_policies p
      on p.schemaname='storage' and p.tablename='objects' and p.policyname=e.policyname
    where p.policyname is null or p.permissive<>'PERMISSIVE'
      or p.roles<>array['authenticated']::name[] or p.cmd<>e.cmd
      or p.qual is distinct from e.qual or p.with_check is distinct from e.with_check
  ) then
    raise exception 'ALPHA_STORAGE_CANONICAL_POLICIES';
  end if;

  if exists (
    select 1 from pg_catalog.pg_class c
    cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.oid in ('storage.objects'::regclass,'storage.buckets'::regclass) and a.grantee=0
  ) or exists (
    select 1 from unnest(array['anon','authenticated']::name[]) r(role_name)
    cross join unnest(array['storage.objects','storage.buckets']::text[]) t(table_name)
    where has_table_privilege(r.role_name,t.table_name,'TRUNCATE')
       or has_table_privilege(r.role_name,t.table_name,'REFERENCES')
       or has_table_privilege(r.role_name,t.table_name,'TRIGGER')
       or has_table_privilege(r.role_name,t.table_name,'MAINTAIN')
  ) or not has_table_privilege('authenticated','storage.objects','SELECT')
     or not has_table_privilege('authenticated','storage.objects','INSERT')
     or not has_table_privilege('authenticated','storage.objects','UPDATE')
     or not has_table_privilege('authenticated','storage.objects','DELETE')
     or not has_table_privilege('anon','storage.objects','SELECT')
     or not has_table_privilege('authenticated','storage.buckets','SELECT')
     or not has_table_privilege('anon','storage.buckets','SELECT') then
    raise exception 'ALPHA_STORAGE_GRANT_CONFIGURATION';
  end if;

  if not exists(select 1 from storage.buckets where id='avatars' and name='avatars' and not public
       and file_size_limit=1048576
       and allowed_mime_types=array['image/webp','image/jpeg','image/png']::text[])
     or exists(select 1 from storage.objects where bucket_id='avatars'
       and name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]webp$') then
    raise exception 'ALPHA_STORAGE_BUCKET_OR_OBJECT_PATH_CONFIGURATION';
  end if;
end
$$;

select 'ALPHA_STORAGE_HARDENING_PASS' as result;
commit;
