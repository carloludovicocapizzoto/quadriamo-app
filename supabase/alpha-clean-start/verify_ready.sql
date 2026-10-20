-- Read-only gate for a NEW Alpha after the five migrations and private key installation.
-- Run as the project postgres role. Never prints the gateway secret or user data.
begin read only;
do $$ begin
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
  if not exists(select 1 from storage.buckets where id='avatars' and not public and file_size_limit=1048576) then
    raise exception 'ALPHA_VERIFY_AVATARS_MISSING';
  end if;
  if exists(select 1 from public.subscriptions) then
    raise exception 'ALPHA_VERIFY_PRO_NOT_EMPTY';
  end if;
end $$;
select 'ALPHA_READY_SQL' as result;
commit;
