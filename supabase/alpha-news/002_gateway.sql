-- OPTIONAL upgrade: only after 001 and explicit Alpha authorization. Existing ACLs are preserved.
begin;
do $$ begin
 if to_regprocedure('alpha_http.check_request()') is null or to_regprocedure('public.alpha_admit_request(text,text)') is null or to_regclass('public.news_items') is null then raise exception 'ALPHA_NEWS_PREREQUISITES'; end if;
end $$;
create or replace function alpha_http.check_request() returns void
language plpgsql security definer set search_path='' as $$
declare h jsonb; method text; path text; ts text; bytes text; signature text;
  canonical text; expected text; secret_key bytea; max_bytes integer; owner_id uuid;
begin
  method=upper(nullif(current_setting('request.method',true),''));
  path=trim(both '/' from nullif(current_setting('request.path',true),''));
  -- Server-only ingestion key: no access to any personal/sync route through this exception.
  if auth.role() = 'service_role' and path in ('news_items','news_sources') and method in ('GET','HEAD','POST','PATCH','DELETE') then return; end if;
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
    'profiles','subscriptions','news_items','news_sources') then
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

create or replace function public.alpha_admit_request(p_route text,p_ip_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid=auth.uid(); b timestamptz; n bigint; p alpha_http.policy;
  allowed boolean=true; retry_after integer;
begin
  if owner_id is null then raise sqlstate '42501' using message='ALPHA_AUTH_REQUIRED'; end if;
  if p_route not in ('rpc/qsync_read','rpc/qsync_write_v2','profiles','subscriptions','news_items','news_sources')
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
revoke all on function alpha_http.check_request(), public.alpha_admit_request(text,text) from public;
grant execute on function alpha_http.check_request() to anon,authenticated,service_role;
grant execute on function public.alpha_admit_request(text,text) to authenticated;
commit;
