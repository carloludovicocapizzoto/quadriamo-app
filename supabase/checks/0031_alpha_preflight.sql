-- Read-only preflight for a new Alpha project immediately before migration 0031.
-- Run after the reviewed 0030 revisioned-sync base and before creating/inviting users.
begin transaction read only;
select current_user as operator,current_database() as database;
do $$
begin
 if current_user <> 'postgres' then
  raise exception 'QSYNC_PREFLIGHT_FAILED: migration 0031 must run as postgres';
 end if;
 if to_regclass('public.user_data') is null or to_regclass('qsync_private.heads') is null
   or to_regclass('qsync_private.history') is null or to_regclass('qsync_private.receipts') is null
   or to_regprocedure('public.qsync_read()') is null
   or to_regprocedure('public.qsync_write(text,uuid,jsonb)') is null then
  raise exception 'QSYNC_PREFLIGHT_FAILED: apply the reviewed 0030 revisioned-sync base first';
 end if;
 if exists(select 1 from auth.users) or exists(select 1 from public.user_data)
   or exists(select 1 from qsync_private.heads) or exists(select 1 from qsync_private.history)
   or exists(select 1 from qsync_private.receipts) then
  raise exception 'QSYNC_PREFLIGHT_FAILED: project is not empty; do not migrate or delete existing data';
 end if;
 if to_regprocedure('public.qsync_write_v2(text,uuid,jsonb)') is not null
   or to_regprocedure('public.qsync_write_v2(text,uuid,text)') is not null
   or to_regprocedure('public.qsync_prune_expired(integer)') is not null
   or exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
      and tgname='qsync_alpha_provision_account' and not tgisinternal) then
  raise exception 'QSYNC_PREFLIGHT_FAILED: migration 0031 is already present; inspect history';
 end if;
 if not exists(select 1 from pg_class c where c.oid='public.user_data'::regclass and c.relrowsecurity
   and pg_get_userbyid(c.relowner)='postgres') then
  raise exception 'QSYNC_PREFLIGHT_FAILED: user_data owner or RLS differs from the reviewed base';
 end if;
end $$;
select 'auth.users' as object,count(*) as rows from auth.users
union all select 'user_data',count(*) from public.user_data
union all select 'heads',count(*) from qsync_private.heads
union all select 'history',count(*) from qsync_private.history
union all select 'receipts',count(*) from qsync_private.receipts;
commit;
