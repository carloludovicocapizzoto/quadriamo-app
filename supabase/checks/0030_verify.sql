-- Read-only post-migration checks. No user payloads, token values or account identifiers are returned.
begin transaction read only;
do $$
begin
 if (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='qsync_private' and c.relkind='r' and c.relrowsecurity) <> 3 then
  raise exception 'QSYNC_CHECK_FAILED: expected three private tables with RLS';
 end if;
 if exists(select 1 from pg_catalog.pg_tables t
   cross join (values ('anon'),('authenticated'),('service_role')) r(role)
   where t.schemaname='qsync_private' and pg_catalog.has_table_privilege(r.role,
     format('%I.%I',t.schemaname,t.tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) then
  raise exception 'QSYNC_CHECK_FAILED: private table privilege granted to a client role';
 end if;
 if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where (n.nspname='qsync_private' or n.nspname='public' and p.proname like 'qsync_%')
     and (pg_catalog.pg_get_userbyid(proowner)<>'postgres' or proconfig is null or not ('search_path=""'=any(proconfig)))) then
  raise exception 'QSYNC_CHECK_FAILED: unexpected routine owner or search path';
 end if;
 if exists(select 1 from (values ('anon'),('service_role')) r(role)
   where pg_catalog.has_function_privilege(r.role,'public.qsync_read()','execute')
     or pg_catalog.has_function_privilege(r.role,'public.qsync_activate()','execute')
     or pg_catalog.has_function_privilege(r.role,'public.qsync_write(text,uuid,jsonb)','execute')) then
  raise exception 'QSYNC_CHECK_FAILED: RPC execution granted to a non-user role';
 end if;
end $$;
select count(*) as owners, count(*) filter(where activation_allowed) as admitted,
       count(*) filter(where protected) as protected, count(*) filter(where paused) as paused
from qsync_private.heads;
select 'history' as kind,count(*) as rows,pg_total_relation_size('qsync_private.history') as total_bytes
from qsync_private.history
union all
select 'receipts',count(*),pg_total_relation_size('qsync_private.receipts') from qsync_private.receipts;
commit;
