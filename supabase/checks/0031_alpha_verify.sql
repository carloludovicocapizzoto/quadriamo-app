-- Read-only post-migration checks for a fresh Alpha project.
-- Run as postgres after migration 0031. Results contain counts only, no account ids or payloads.
begin transaction read only;
do $$
begin
 if current_user <> 'postgres' then
  raise exception 'QSYNC_CHECK_FAILED: run as postgres';
 end if;
 if exists(select 1 from (values
   ('heads'),('history'),('receipts'),('policy'),('daily_usage')
  ) expected(name)
  where not exists(select 1 from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname='qsync_private' and c.relname=expected.name and c.relkind='r' and c.relrowsecurity)) then
  raise exception 'QSYNC_CHECK_FAILED: missing protected private tables';
 end if;
 if has_schema_privilege('authenticated','qsync_private','usage')
   or has_schema_privilege('anon','qsync_private','usage')
   or has_schema_privilege('service_role','qsync_private','usage') then
  raise exception 'QSYNC_CHECK_FAILED: private schema exposed to API roles';
 end if;
 if has_table_privilege('authenticated','public.user_data','INSERT,UPDATE,DELETE,TRUNCATE')
   or has_table_privilege('anon','public.user_data','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   or has_table_privilege('service_role','public.user_data','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
  raise exception 'QSYNC_CHECK_FAILED: direct user_data access granted to an API role';
 end if;
 if not has_table_privilege('authenticated','public.user_data','SELECT') then
  raise exception 'QSYNC_CHECK_FAILED: authenticated remote read is unavailable';
 end if;
 if not exists(select 1 from pg_catalog.pg_proc p
   where p.oid='public.qsync_write_v2(text,uuid,text)'::regprocedure
    and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig is not null and 'search_path=""'=any(p.proconfig)) then
  raise exception 'QSYNC_CHECK_FAILED: qsync_write_v2 owner or search_path is unsafe';
 end if;
 if not has_function_privilege('authenticated','public.qsync_write_v2(text,uuid,text)','execute')
   or has_function_privilege('anon','public.qsync_write_v2(text,uuid,text)','execute')
   or has_function_privilege('service_role','public.qsync_write_v2(text,uuid,text)','execute') then
  raise exception 'QSYNC_CHECK_FAILED: qsync_write_v2 execution grants are unsafe';
 end if;
 if not has_function_privilege('service_role','public.qsync_prune_expired(integer)','execute')
   or has_function_privilege('authenticated','public.qsync_prune_expired(integer)','execute')
   or has_function_privilege('anon','public.qsync_prune_expired(integer)','execute') then
  raise exception 'QSYNC_CHECK_FAILED: prune execution grants are unsafe';
 end if;
 if exists(select 1 from pg_catalog.pg_proc p
   cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   where p.oid in ('public.qsync_write_v2(text,uuid,text)'::regprocedure,
    'public.qsync_prune_expired(integer)'::regprocedure)
    and acl.grantee=0 and acl.privilege_type='EXECUTE') then
  raise exception 'QSYNC_CHECK_FAILED: PUBLIC can execute a protected RPC';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='qsync_private'
   and table_name in ('history','receipts') and column_name='document')
   or not exists(select 1 from information_schema.columns where table_schema='qsync_private'
    and table_name='receipts' and column_name='request_hash') then
  raise exception 'QSYNC_CHECK_FAILED: full documents remain in the archive or receipt hashes are missing';
 end if;
 if exists(select 1 from (values ('heads'),('daily_usage'),('history'),('receipts')) expected(name)
   where not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='qsync_private' and c.relname=expected.name
     and c.reloptions @> array['autovacuum_vacuum_threshold=50','autovacuum_vacuum_scale_factor=0.05',
       'autovacuum_analyze_threshold=50','autovacuum_analyze_scale_factor=0.05']
     and (expected.name not in ('heads','daily_usage') or c.reloptions @> array['fillfactor=70']))) then
  raise exception 'QSYNC_CHECK_FAILED: sync-table autovacuum/fillfactor settings are not installed';
 end if;
 if exists(select 1 from qsync_private.heads where not protected or minimum_protocol<2) then
  raise exception 'QSYNC_CHECK_FAILED: a new Alpha account is not protected by protocol 2';
 end if;
end $$;
select (select count(*) from auth.users) as accounts,
       (select count(*) from qsync_private.heads) as protected_heads,
       (select count(*) from qsync_private.heads where paused) as paused_heads;
select 'history' as table_name,count(*) as rows,pg_total_relation_size('qsync_private.history') as physical_bytes
 from qsync_private.history
union all
select 'receipts',count(*),pg_total_relation_size('qsync_private.receipts') from qsync_private.receipts
union all
select 'daily_usage',count(*),pg_total_relation_size('qsync_private.daily_usage') from qsync_private.daily_usage;
commit;
