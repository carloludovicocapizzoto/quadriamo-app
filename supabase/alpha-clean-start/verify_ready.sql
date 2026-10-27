-- Read-only gate for Alpha after the five base migrations, the incremental avatar hardening migration, and private key installation.
-- Run as the project postgres role. Never prints the gateway secret or user data.
begin read only;
do $$ begin
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
    raise exception 'ALPHA_VERIFY_MIGRATION_HISTORY';
  end if;
  if to_regclass('public.user_data') is null or to_regclass('public.profiles') is null
     or to_regclass('public.subscriptions') is null or to_regclass('qsync_private.heads') is null
     or to_regclass('qsync_private.receipts') is null or to_regclass('alpha_http.requests') is null then
    raise exception 'ALPHA_VERIFY_SCHEMA_MISSING';
  end if;
  if not exists(select 1 from pg_class where oid='public.user_data'::regclass and relrowsecurity)
     or not exists(select 1 from pg_class where oid='public.profiles'::regclass and relrowsecurity)
     or not exists(select 1 from pg_class where oid='public.subscriptions'::regclass and relrowsecurity) then
    raise exception 'ALPHA_VERIFY_RLS_DISABLED';
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
    raise exception 'ALPHA_VERIFY_STORAGE_RLS_ROLES';
  end if;
  if has_table_privilege('anon','public.user_data','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.user_data','INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','public.user_data','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'ALPHA_VERIFY_DIRECT_WRITE';
  end if;
  if not has_function_privilege('authenticated','public.qsync_write_v2(text,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.qsync_write(text,uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.qsync_activate()','EXECUTE') then
    raise exception 'ALPHA_VERIFY_RPC_PRIVILEGES';
  end if;
  if exists(select 1 from auth.users u left join qsync_private.heads h on h.user_id=u.id
    where h.user_id is null or not h.protected or h.minimum_protocol<>2 or h.activation_allowed) then
    raise exception 'ALPHA_VERIFY_UNPROTECTED_USER';
  end if;
  if (select count(*) from alpha_http.gateway_key)<>1 then
    raise exception 'ALPHA_VERIFY_GATEWAY_KEY_MISSING';
  end if;
  if not exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
    where r.rolname='authenticator' and 'pgrst.db_pre_request=alpha_http.check_request'=any(s.setconfig)) then
    raise exception 'ALPHA_VERIFY_DATA_API_HOOK_MISSING';
  end if;
  if (select count(*) from cron.job where jobname='quadriamo_alpha_maintenance')<>1 then
    raise exception 'ALPHA_VERIFY_MAINTENANCE_MISSING';
  end if;
  if (select count(*) from storage.buckets)<>1
     or not exists(select 1 from storage.buckets where id='avatars' and name='avatars' and not public
       and file_size_limit=1048576
       and allowed_mime_types=array['image/webp','image/jpeg','image/png']::text[]) then
    raise exception 'ALPHA_VERIFY_AVATARS_MISSING';
  end if;
  if (select count(*) from pg_catalog.pg_policies where schemaname='storage' and tablename='objects')<>4
     or exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='buckets') then
    raise exception 'ALPHA_VERIFY_STORAGE_POLICY_INVENTORY';
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
    raise exception 'ALPHA_VERIFY_AVATAR_POLICIES';
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
    raise exception 'ALPHA_VERIFY_STORAGE_GRANTS';
  end if;
  if exists(select 1 from storage.objects where bucket_id='avatars'
      and name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]webp$') then
    raise exception 'ALPHA_VERIFY_AVATAR_OBJECT_PATHS';
  end if;
  if exists(select 1 from public.subscriptions) then
    raise exception 'ALPHA_VERIFY_PRO_NOT_EMPTY';
  end if;
end $$;
select 'ALPHA_READY_SQL' as result;
commit;
