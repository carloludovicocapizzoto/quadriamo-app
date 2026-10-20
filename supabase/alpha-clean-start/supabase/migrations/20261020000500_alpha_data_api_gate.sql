-- A separate Alpha project only. This gate protects the DIRECT PostgREST endpoint.
-- Provision a random gateway key through the private runbook before serving traffic.
-- The key never belongs in a migration, frontend bundle, or public environment variable.
begin;
set local lock_timeout='5s';
do $$ begin
  if current_user <> 'postgres' or to_regclass('qsync_private.policy') is null
     or to_regprocedure('public.qsync_write_v2(text,uuid,text)') is null
     or to_regnamespace('alpha_http') is not null
     or exists (select 1 from auth.users) then
    raise exception 'ALPHA_HTTP_PREREQUISITE: use the empty dedicated Alpha after 0031';
  end if;
  if to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'ALPHA_HTTP_PREREQUISITE: pgcrypto hmac is required';
  end if;
end $$;

create schema alpha_http;
revoke all on schema alpha_http from public;
grant usage on schema alpha_http to anon,authenticated,service_role;

create table alpha_http.gateway_key (
  id boolean primary key default true check(id),
  secret bytea not null check(octet_length(secret)>=32),
  installed_at timestamptz not null default clock_timestamp()
);
create table alpha_http.policy (
  id boolean primary key default true check(id),
  max_body_bytes integer not null check(max_body_bytes between 1048576 and 4194304),
  per_user_minute integer not null check(per_user_minute between 1 and 300),
  per_write_minute integer not null check(per_write_minute between 1 and 100),
  per_ip_minute integer not null check(per_ip_minute between 1 and 1000)
);
insert into alpha_http.policy values(true,2097152,120,30,300);
create table alpha_http.requests (
  minute_utc timestamptz not null,
  scope text not null check(scope in ('user','write','ip')),
  key text not null check(char_length(key) between 1 and 128),
  hits bigint not null check(hits>0),
  primary key(minute_utc,scope,key)
);
create index alpha_http_requests_minute on alpha_http.requests(minute_utc);
revoke all on all tables in schema alpha_http from public,anon,authenticated,service_role;

-- PostgREST calls this before every Data API operation. A browser cannot furnish a
-- signature: only the separate Pages Function holds the key. Invalid/missing keys
-- fail closed, including direct calls to the otherwise publicly reachable endpoint.
create function alpha_http.check_request() returns void
language plpgsql security definer set search_path='' as $$
declare h jsonb; method text; path text; ts text; bytes text; signature text;
  canonical text; expected text; secret_key bytea; max_bytes integer; owner_id uuid;
begin
  owner_id=auth.uid();
  if auth.role() is distinct from 'authenticated' or owner_id is null then
    raise sqlstate '42501' using message='ALPHA_AUTH_REQUIRED';
  end if;
  h=nullif(current_setting('request.headers',true),'')::jsonb;
  method=upper(nullif(current_setting('request.method',true),''));
  path=trim(both '/' from nullif(current_setting('request.path',true),''));
  ts=h->>'x-alpha-ts'; bytes=h->>'x-alpha-bytes'; signature=h->>'x-alpha-signature';
  if method not in ('GET','HEAD','POST','PATCH') or path not in (
    'rpc/alpha_admit_request','rpc/qsync_read','rpc/qsync_write_v2',
    'profiles','subscriptions') then
    raise sqlstate '42501' using message='ALPHA_ROUTE_DENIED';
  end if;
  select secret into secret_key from alpha_http.gateway_key where id;
  if secret_key is null then raise sqlstate 'PT503' using message='ALPHA_GATEWAY_UNCONFIGURED'; end if;
  if ts is null or ts !~ '^[0-9]{10,11}$' or bytes is null or bytes !~ '^(0|[1-9][0-9]{0,7})$'
     or signature is null or signature !~ '^[0-9a-f]{64}$'
     or abs(extract(epoch from clock_timestamp())::bigint-ts::bigint)>30 then
    raise sqlstate '42501' using message='ALPHA_GATEWAY_SIGNATURE_REQUIRED';
  end if;
  select max_body_bytes into max_bytes from alpha_http.policy where id;
  if bytes::integer>max_bytes then
    raise sqlstate 'PT413' using message='ALPHA_HTTP_BODY_TOO_LARGE';
  end if;
  canonical=ts||E'\n'||method||E'\n'||path||E'\n'||owner_id::text||E'\n'||bytes;
  expected=encode(extensions.hmac(convert_to(canonical,'UTF8'),secret_key,'sha256'),'hex');
  if signature is distinct from expected then
    raise sqlstate '42501' using message='ALPHA_GATEWAY_SIGNATURE_REQUIRED';
  end if;
end $$;
revoke all on function alpha_http.check_request() from public,anon,authenticated,service_role;
grant execute on function alpha_http.check_request() to anon,authenticated,service_role;

-- This is a SEPARATE committed RPC. It charges every request admitted by the Pages
-- Function, even if the following sync RPC fails or the supplied JSON is malformed.
-- It cannot be called directly without the private gateway signature above.
create function public.alpha_admit_request(p_route text,p_ip_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid=auth.uid(); b timestamptz; n bigint; p alpha_http.policy;
  allowed boolean=true; retry_after integer;
begin
  if owner_id is null then raise sqlstate '42501' using message='ALPHA_AUTH_REQUIRED'; end if;
  if p_route not in ('rpc/qsync_read','rpc/qsync_write_v2','profiles','subscriptions')
     or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise sqlstate '22023' using message='ALPHA_ADMISSION_INVALID';
  end if;
  select * into strict p from alpha_http.policy where id;
  b=date_trunc('minute',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  insert into alpha_http.requests values(b,'user',owner_id::text,1)
    on conflict(minute_utc,scope,key) do update set hits=alpha_http.requests.hits+1 returning hits into n;
  if n>p.per_user_minute then allowed=false; end if;
  if p_route='rpc/qsync_write_v2' then
    insert into alpha_http.requests values(b,'write',owner_id::text,1)
      on conflict(minute_utc,scope,key) do update set hits=alpha_http.requests.hits+1 returning hits into n;
    if n>p.per_write_minute then allowed=false; end if;
  end if;
  insert into alpha_http.requests values(b,'ip',p_ip_hash,1)
    on conflict(minute_utc,scope,key) do update set hits=alpha_http.requests.hits+1 returning hits into n;
  if n>p.per_ip_minute then allowed=false; end if;
  retry_after=greatest(1,ceil(extract(epoch from b+interval '1 minute'-clock_timestamp()))::integer);
  return jsonb_build_object('allowed',allowed,'retry_after_seconds',case when allowed then 0 else retry_after end);
end $$;
revoke all on function public.alpha_admit_request(text,text) from public,anon,service_role;
grant execute on function public.alpha_admit_request(text,text) to authenticated;

-- Scheduled on this new project only; no legacy cron jobs are imported.
create function alpha_http.maintenance() returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
  delete from alpha_http.requests where minute_utc<clock_timestamp()-interval '48 hours';
  for owner_id in select user_id from qsync_private.heads
    where last_pruned_at is null or last_pruned_at<clock_timestamp()-interval '24 hours'
    order by last_pruned_at nulls first,user_id limit 500 for update skip locked
  loop
    perform qsync_private.prune_user(owner_id);
  end loop;
end $$;
revoke all on function alpha_http.maintenance() from public,anon,authenticated,service_role;

create extension if not exists pg_cron with schema extensions;
do $$ begin
  if exists(select 1 from cron.job where jobname='quadriamo_alpha_maintenance') then
    raise exception 'ALPHA_CRON_ALREADY_PRESENT';
  end if;
end $$;
select cron.schedule('quadriamo_alpha_maintenance','0 * * * *','select alpha_http.maintenance()');

-- v1 writes and activation have no role in the clean-start project.
revoke execute on function public.qsync_write(text,uuid,jsonb),public.qsync_activate() from authenticated;
alter role authenticator set pgrst.db_pre_request='alpha_http.check_request';
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
