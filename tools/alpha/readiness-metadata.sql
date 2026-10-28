-- READ-ONLY infrastructure metadata; no user contents, identities, object paths or secret values.
-- Operator must first verify dashboard project ref djkoxecmobafenfazcum. Not a migration.
begin read only;
select pg_database_size(current_database()) as database_bytes;
select version,name from supabase_migrations.schema_migrations order by version;
select * from qsync_private.policy;
select * from alpha_http.policy;
select exists(select 1 from alpha_http.gateway_key) as gateway_key_present;
select c as pre_request from pg_roles r,unnest(r.rolconfig) c
 where r.rolname='authenticator' and c like 'pgrst.db_pre_request=%';
select schemaname,tablename,pg_total_relation_size(format('%I.%I',schemaname,tablename)) as bytes
 from pg_tables where schemaname in('qsync_private','alpha_http') order by 1,2;
select jobname,active,schedule from cron.job where jobname='quadriamo_alpha_maintenance';
select status,start_time,end_time from cron.job_run_details
 where jobid in(select jobid from cron.job where jobname='quadriamo_alpha_maintenance') order by start_time desc limit 3;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars';
select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname='public' and c.relname in('user_data','profiles','subscriptions'))
 or (n.nspname='storage' and c.relname in('objects','buckets'));
select schemaname,tablename,cmd,roles,qual,with_check from pg_policies
 where (schemaname='storage' and tablename in('objects','buckets'))
 or (schemaname='public' and tablename in('user_data','profiles','subscriptions'));
select rolname,rolsuper,rolbypassrls from pg_roles where rolname in('anon','authenticated','authenticator','service_role');
select pg_has_role('anon','service_role','MEMBER') as anon_service_member,
 pg_has_role('authenticated','service_role','MEMBER') as authenticated_service_member;
select has_table_privilege('authenticated','public.user_data','INSERT,UPDATE,DELETE') as direct_write,
 has_function_privilege('authenticated','public.qsync_prune_expired(integer)','EXECUTE') as client_prune,
 has_function_privilege('anon','public.qsync_write_v2(text,uuid,text)','EXECUTE') as anon_cas_write;
select table_name,column_name from information_schema.columns where table_schema='qsync_private'
 and table_name in('history','receipts') and column_name in('document','document_hash','request_hash','response');
select setting as autovacuum from pg_settings where name='autovacuum';
rollback;
