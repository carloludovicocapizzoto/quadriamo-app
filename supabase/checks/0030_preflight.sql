-- Read-only inventory. Review the results before authorizing migration 0030.
-- This file does not establish that external services or dynamically generated SQL are safe.
begin transaction read only;
select current_user as operator, current_database() as database;
select c.relname, pg_catalog.pg_get_userbyid(c.relowner) as owner, c.relrowsecurity,
       pg_catalog.pg_total_relation_size(c.oid) as total_bytes
from pg_catalog.pg_class c where c.oid='public.user_data'::regclass;
select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname='public' and tablename='user_data';
select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='user_data' order by grantee,privilege_type;
select n.nspname as schema, p.proname, p.oid::regprocedure as signature,
       pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname not in ('pg_catalog','information_schema')
  and (p.prosrc ilike '%user_data%' or p.proname like 'qsync_%')
order by n.nspname,p.proname;
select tgname, pg_catalog.pg_get_triggerdef(oid) as definition
from pg_catalog.pg_trigger where tgrelid='public.user_data'::regclass and not tgisinternal;
select count(*) as documents,
       count(*) filter (where data->'version' is distinct from '1'::jsonb
         or jsonb_typeof(data->'settings') is distinct from 'object'
         or jsonb_typeof(data->'transactions') is distinct from 'array') as incompatible_documents,
       max(pg_column_size(data)) as largest_stored_document_bytes
from public.user_data;
select rolname, rolsuper, rolbypassrls from pg_catalog.pg_roles
where rolname in ('postgres','supabase_admin','authenticated','anon','service_role');
commit;
