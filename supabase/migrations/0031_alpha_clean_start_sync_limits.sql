-- Clean-start Alpha synchronization, protocol 2.
-- Apply only to a newly created, empty Alpha project after an isolated backup/restore rehearsal.
-- Existing accounts and their revisioned history are deliberately not migrated or compacted.
begin;
set local lock_timeout = '5s';

do $$ begin
 if current_user <> 'postgres' then
  raise exception 'QSYNC_ALPHA_OWNER_REQUIRED: run as postgres, not a client/service role';
 end if;
 if to_regclass('public.user_data') is null or to_regclass('qsync_private.heads') is null
   or to_regclass('qsync_private.history') is null or to_regclass('qsync_private.receipts') is null
   or to_regprocedure('public.qsync_read()') is null
   or to_regprocedure('public.qsync_write(text,uuid,jsonb)') is null then
  raise exception 'QSYNC_ALPHA_PREREQUISITE: apply the reviewed revisioned-sync migration first';
 end if;
 if exists (select 1 from auth.users)
   or exists (select 1 from public.user_data)
   or exists (select 1 from qsync_private.heads)
   or exists (select 1 from qsync_private.history)
   or exists (select 1 from qsync_private.receipts) then
  raise exception 'QSYNC_ALPHA_NOT_EMPTY: use a new empty project; preserve all existing accounts and history';
 end if;
 if exists (select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgname='qsync_alpha_provision_account')
   or to_regprocedure('public.qsync_write_v2(text,uuid,jsonb)') is not null
   or to_regprocedure('public.qsync_write_v2(text,uuid,text)') is not null
   or to_regprocedure('public.qsync_prune_expired(integer)') is not null then
  raise exception 'QSYNC_ALPHA_ALREADY_PRESENT: inspect migration history; do not overwrite';
 end if;
 if not exists (select 1 from pg_catalog.pg_class where oid='public.user_data'::regclass and relrowsecurity
   and pg_catalog.pg_get_userbyid(relowner)='postgres') then
  raise exception 'QSYNC_ALPHA_PREREQUISITE: public.user_data must be owned by postgres with RLS enabled';
 end if;
end $$;

-- Close the account-creation/write race while the empty-project preconditions are enforced.
lock table auth.users in share row exclusive mode;
lock table public.user_data in share row exclusive mode;

-- Recheck after the locks are acquired: an Auth insert that committed while the first
-- preflight read was running must still make this migration fail closed.
do $$ begin
 if exists (select 1 from auth.users)
   or exists (select 1 from public.user_data)
   or exists (select 1 from qsync_private.heads)
   or exists (select 1 from qsync_private.history)
   or exists (select 1 from qsync_private.receipts) then
  raise exception 'QSYNC_ALPHA_NOT_EMPTY: account state appeared during preflight; preserve it and use a new empty project';
 end if;
end $$;

-- These columns previously held full documents. The empty-project guard above makes this
-- structural change safe and keeps the PR2/legacy environment and its evidence untouched.
drop trigger qsync_after_write on public.user_data;
alter table qsync_private.history drop column document;
alter table qsync_private.history add column document_hash text;
alter table qsync_private.history add constraint qsync_history_hash_format
  check (document_hash is null or document_hash ~ '^[0-9a-f]{64}$');
alter table qsync_private.receipts drop column document;
alter table qsync_private.receipts add column request_hash text;
alter table qsync_private.receipts add constraint qsync_receipt_hash_format
  check (request_hash ~ '^[0-9a-f]{64}$');
alter table qsync_private.receipts alter column request_hash set not null;
alter table qsync_private.heads add column last_pruned_at timestamptz;
alter table qsync_private.heads alter column minimum_protocol set default 2;

create table qsync_private.policy (
 policy_id boolean primary key default true check (policy_id),
 document_max_bytes integer not null check (document_max_bytes between 1024 and 1048576),
 daily_max_operations integer not null check (daily_max_operations between 1 and 200),
 daily_max_payload_bytes bigint not null check (daily_max_payload_bytes between 1048576 and 33554432),
 receipt_retention_days integer not null check (receipt_retention_days >= 90),
 minimum_retained_operations integer not null check (minimum_retained_operations >= 1000),
 minimum_retained_revisions integer not null check (minimum_retained_revisions >= 1000),
 max_json_depth integer not null check (max_json_depth between 8 and 32),
 max_json_nodes integer not null check (max_json_nodes between 1000 and 50000),
 max_string_bytes integer not null check (max_string_bytes between 1024 and 16384),
 max_key_bytes integer not null check (max_key_bytes between 32 and 512),
 max_transactions integer not null check (max_transactions between 1 and 10000),
 max_setting_items integer not null check (max_setting_items between 1 and 2000)
);
insert into qsync_private.policy values
 (true,1048576,200,33554432,90,1000,1000,20,50000,16384,256,10000,2000);

create table qsync_private.daily_usage (
 user_id uuid not null references qsync_private.heads(user_id) on delete cascade,
 utc_day date not null,
 new_operations integer not null default 0 check (new_operations >= 0),
 request_bytes bigint not null default 0 check (request_bytes >= 0),
 primary key (user_id,utc_day)
);

-- Keep row updates HOT-friendly and vacuum deleted/updated tuples before bloat accumulates.
-- PostgreSQL autovacuum must remain enabled on every Alpha target; these per-table thresholds
-- are intentionally more responsive than the cluster-wide defaults for the sync ledger.
alter table qsync_private.heads set (
 fillfactor=70,autovacuum_vacuum_threshold=50,autovacuum_vacuum_scale_factor=0.05,
 autovacuum_analyze_threshold=50,autovacuum_analyze_scale_factor=0.05
);
alter table qsync_private.daily_usage set (
 fillfactor=70,autovacuum_vacuum_threshold=50,autovacuum_vacuum_scale_factor=0.05,
 autovacuum_analyze_threshold=50,autovacuum_analyze_scale_factor=0.05
);
alter table qsync_private.history set (
 autovacuum_vacuum_threshold=50,autovacuum_vacuum_scale_factor=0.05,
 autovacuum_analyze_threshold=50,autovacuum_analyze_scale_factor=0.05
);
alter table qsync_private.receipts set (
 autovacuum_vacuum_threshold=50,autovacuum_vacuum_scale_factor=0.05,
 autovacuum_analyze_threshold=50,autovacuum_analyze_scale_factor=0.05
);

alter table qsync_private.policy enable row level security;
alter table qsync_private.daily_usage enable row level security;
revoke all on all tables in schema qsync_private from public,anon,authenticated,service_role;
revoke all on schema qsync_private from public,anon,authenticated,service_role;
revoke all on function qsync_private.guard_owner(uuid,text,boolean) from public,anon,authenticated,service_role;

create function qsync_private.document_stats(p_document jsonb)
returns table(node_count bigint,max_depth integer,max_string_bytes integer,max_key_bytes integer)
language sql immutable security definer set search_path='' as $$
 with recursive walk(value,depth,key_name) as (
  select p_document,1,null::text
  union all
  select child.value,walk.depth+1,child.key_name
  from walk
  cross join lateral (
   select entry.key as key_name,entry.value from (
    select object_entry.key,object_entry.value
    from jsonb_each(case when jsonb_typeof(walk.value)='object' then walk.value else '{}'::jsonb end) object_entry
    limit 50001
   ) entry
   union all
   select null::text as key_name,entry.value from (
    select array_entry.value
    from jsonb_array_elements(case when jsonb_typeof(walk.value)='array' then walk.value else '[]'::jsonb end) array_entry
    limit 50001
   ) entry
  ) child
  where walk.depth<33
 ), bounded as (
  select value,depth,key_name from walk limit 50001
 )
 select count(*),coalesce(max(depth),0),
  coalesce(max(octet_length(convert_to(value#>>'{}','UTF8'))) filter(where jsonb_typeof(value)='string'),0),
  coalesce(max(octet_length(convert_to(key_name,'UTF8'))) filter(where key_name is not null),0)
 from bounded
$$;

create function qsync_private.validate_document(p_document jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare p qsync_private.policy; stats record; bytes integer; schema_value jsonb; schema_number numeric;
begin
 select * into strict p from qsync_private.policy where policy_id;
 if p_document is null or jsonb_typeof(p_document) is distinct from 'object'
   or p_document->'version' is distinct from '1'::jsonb
   or (p_document ? 'demo' and (jsonb_typeof(p_document->'demo') is distinct from 'boolean' or p_document->'demo'<>'false'::jsonb))
   or jsonb_typeof(p_document->'settings') is distinct from 'object'
   or jsonb_typeof(p_document#>'{settings,buckets}') is distinct from 'array'
   or jsonb_typeof(p_document#>'{settings,categories}') is distinct from 'array'
   or jsonb_typeof(p_document->'transactions') is distinct from 'array' then
  raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID';
 end if;
 if (p_document#>'{settings,events}' is null and p_document#>'{settings,recurring}' is null)
   or (p_document#>'{settings,events}' is not null and jsonb_typeof(p_document#>'{settings,events}') is distinct from 'array')
   or (p_document#>'{settings,recurring}' is not null and jsonb_typeof(p_document#>'{settings,recurring}') is distinct from 'array') then
  raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID';
 end if;
 schema_value=p_document#>'{settings,schema}';
 if schema_value is not null and schema_value<>'null'::jsonb then
  if jsonb_typeof(schema_value) is distinct from 'number' then raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID'; end if;
  schema_number=(schema_value#>>'{}')::numeric;
  if schema_number<0 or schema_number>5 or trunc(schema_number)<>schema_number then
   raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID';
  end if;
 end if;

 bytes=octet_length(convert_to(p_document::text,'UTF8'));
 if bytes>p.document_max_bytes then
  raise sqlstate 'PT413' using message='QSYNC_DOCUMENT_TOO_LARGE',
   detail=jsonb_build_object('max_bytes',p.document_max_bytes,'document_bytes',bytes)::text;
 end if;
 if jsonb_array_length(p_document->'transactions')>p.max_transactions
   or jsonb_array_length(p_document#>'{settings,buckets}')>p.max_setting_items
   or jsonb_array_length(p_document#>'{settings,categories}')>p.max_setting_items
   or coalesce(jsonb_array_length(p_document#>'{settings,events}'),0)>p.max_setting_items
   or coalesce(jsonb_array_length(p_document#>'{settings,recurring}'),0)>p.max_setting_items then
  raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID',detail='QSYNC_DOCUMENT_COLLECTION_LIMIT';
 end if;
 if exists(select 1 from jsonb_array_elements(p_document->'transactions') item
   where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string' or coalesce(item->>'id','')='')
   or (select count(*) from jsonb_array_elements(p_document->'transactions')) <>
      (select count(distinct item->>'id') from jsonb_array_elements(p_document->'transactions') item) then
  raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID',detail='QSYNC_DOCUMENT_TRANSACTION_IDS';
 end if;
 select * into stats from qsync_private.document_stats(p_document);
 if stats.node_count>p.max_json_nodes or stats.max_depth>p.max_json_depth
   or stats.max_string_bytes>p.max_string_bytes or stats.max_key_bytes>p.max_key_bytes then
  raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID',detail='QSYNC_DOCUMENT_SHAPE_LIMIT';
 end if;
 return bytes;
end $$;

create function qsync_private.prune_user(p_user uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare p qsync_private.policy; h qsync_private.heads; removed bigint=0; n bigint;
begin
 select * into strict p from qsync_private.policy where policy_id;
 select * into h from qsync_private.heads where user_id=p_user for update;
 if not found then return 0; end if;
 delete from qsync_private.history x
  where x.user_id=p_user
   and x.recorded_at<clock_timestamp()-make_interval(days=>p.receipt_retention_days)
   and x.revision<=greatest(h.revision-p.minimum_retained_revisions,0);
 get diagnostics n=row_count; removed=removed+n;
 with ranked as (
  select x.operation,row_number() over(order by x.recorded_at desc,x.operation desc) as keep_rank
  from qsync_private.receipts x where x.user_id=p_user
 )
 delete from qsync_private.receipts x using ranked r
  where x.user_id=p_user and x.operation=r.operation
   and r.keep_rank>p.minimum_retained_operations
   -- Match the five-minute future-clock tolerance in qsync_write_v2. Every accepted
   -- UUID whose receipt is removed is then unambiguously outside its replay window.
   and x.recorded_at<clock_timestamp()-make_interval(days=>p.receipt_retention_days)-interval '5 minutes';
 get diagnostics n=row_count; removed=removed+n;
 delete from qsync_private.daily_usage
  where user_id=p_user and utc_day<((clock_timestamp() at time zone 'UTC')::date-p.receipt_retention_days+1);
 get diagnostics n=row_count; removed=removed+n;
 update qsync_private.heads set last_pruned_at=clock_timestamp() where user_id=p_user;
 return removed;
end $$;

create or replace function qsync_private.after_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; n bigint; doc_hash text;
begin
 owner_id=case when TG_OP='DELETE' then old.user_id else new.user_id end;
 if not exists(select 1 from auth.users where id=owner_id) then return null; end if;
 if TG_OP='UPDATE' and new.data is not distinct from old.data then return null; end if;
 update qsync_private.heads set revision=revision+1 where user_id=owner_id returning revision into n;
 if TG_OP<>'DELETE' then doc_hash=encode(sha256(convert_to(new.data::text,'UTF8')),'hex'); end if;
 insert into qsync_private.history(user_id,revision,document_hash)
 values(owner_id,n,doc_hash);
 return null;
end $$;
create trigger qsync_after_write after insert or update or delete on public.user_data
for each row execute function qsync_private.after_write();

create function qsync_private.provision_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into qsync_private.heads(user_id,revision,protected,activation_allowed,paused,minimum_protocol,activated_at)
 values(new.id,0,true,false,false,2,clock_timestamp());
 return new;
end $$;
create trigger qsync_alpha_provision_account after insert on auth.users
for each row execute function qsync_private.provision_account();

create or replace function public.qsync_read() returns jsonb
language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then null else jsonb_build_object(
  'protocol',coalesce(h.minimum_protocol,2),'revision',coalesce(h.revision,0)::text,
  'mode',case when h.paused then 'paused' when coalesce(h.protected,true) then 'protected' else 'legacy' end,
  'document',u.data,'activationAllowed',false)
 end
 from (select auth.uid() as id) a
 left join qsync_private.heads h on h.user_id=a.id
 left join public.user_data u on u.user_id=a.id
$$;

create function public.qsync_write_v2(p_expected_revision text,p_operation uuid,p_document_json text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid=auth.uid(); h qsync_private.heads; r qsync_private.receipts; usage_row qsync_private.daily_usage;
 expected bigint; doc_bytes integer; raw_bytes integer; request_hash text; answer jsonb; operation_bytes bytea;
 operation_ms bigint; operation_at timestamptz; current_at timestamptz; v_utc_day date; retry_after integer;
 rejection_code text; rejection_detail text; rejection_status integer;
 error_state text; error_message text; error_detail text; error_http_status integer; parsed_document jsonb;
 p qsync_private.policy;
begin
 if owner_id is null then raise sqlstate '42501' using message='QSYNC_AUTH_REQUIRED'; end if;
 if p_expected_revision is null or p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$' or p_operation is null then
  raise sqlstate '22023' using message='QSYNC_INVALID_REQUEST';
 end if;
 expected=p_expected_revision::bigint;
 current_at=clock_timestamp();
 select * into strict p from qsync_private.policy where policy_id;
 select * into h from qsync_private.heads where user_id=owner_id for update;
 if not found or not h.protected or h.minimum_protocol<>2 then raise sqlstate 'PT409' using message='QSYNC_UPGRADE_REQUIRED'; end if;

 -- The RPC accepts serialized JSON text so oversized or malformed payloads can be counted
 -- and rejected before PostgreSQL expands them into an unbounded JSONB tree.
 raw_bytes=coalesce(octet_length(convert_to(p_document_json,'UTF8')),0);

 -- A receipt wins over its age: retained operations continue to replay their immutable ACK.
 select * into r from qsync_private.receipts where user_id=owner_id and operation=p_operation;
 if found then
  -- Every stored request is within the document cap. A larger body cannot be an exact
  -- retry, so reject UUID reuse without hashing the oversized input.
  if raw_bytes>p.document_max_bytes then raise sqlstate '22023' using message='QSYNC_OPERATION_REUSED'; end if;
  request_hash=encode(sha256(convert_to(p_expected_revision||E'\n'||coalesce(p_document_json,'<null>'),'UTF8')),'hex');
  if r.expected_revision is distinct from expected or r.request_hash is distinct from request_hash then
   raise sqlstate '22023' using message='QSYNC_OPERATION_REUSED';
  end if;
  return r.response||jsonb_build_object('replay',true);
 end if;
 if h.paused then raise sqlstate 'PT503' using message='QSYNC_PAUSED'; end if;

 v_utc_day=(current_at at time zone 'UTC')::date;
 insert into qsync_private.daily_usage(user_id,utc_day) values(owner_id,v_utc_day) on conflict do nothing;
 select * into usage_row from qsync_private.daily_usage where user_id=owner_id and utc_day=v_utc_day for update;
 retry_after=greatest(1,ceil(extract(epoch from (((v_utc_day+1)::timestamp at time zone 'UTC')-current_at)))::integer);
 -- A known receipt above remains replayable. An exhausted bucket rejects new operations before
 -- hashing the body, which avoids spending more CPU on an account already over its daily cap.
 if usage_row.new_operations>=p.daily_max_operations then
  if h.last_pruned_at is null or h.last_pruned_at<current_at-interval '24 hours' then
   perform qsync_private.prune_user(owner_id);
  end if;
  return jsonb_build_object('protocol',2,'status','rejected','operation',p_operation,
   'code','QSYNC_RATE_LIMITED','httpStatus',429,
   'details',jsonb_build_object('retry_after_seconds',retry_after,'max_operations',p.daily_max_operations,
    'max_payload_bytes',p.daily_max_payload_bytes),'replay',false);
 end if;

 -- An oversized document is a permanent rejection. Count its attempt but never hash,
 -- parse, or store a body that cannot enter the current-document contract.
 if raw_bytes>p.document_max_bytes then
  update qsync_private.daily_usage set new_operations=new_operations+1,request_bytes=request_bytes+raw_bytes
   where user_id=owner_id and utc_day=v_utc_day;
  if h.last_pruned_at is null or h.last_pruned_at<current_at-interval '24 hours' then
   perform qsync_private.prune_user(owner_id);
  end if;
  return jsonb_build_object('protocol',2,'status','rejected','operation',p_operation,
   'code','QSYNC_DOCUMENT_TOO_LARGE','httpStatus',413,
   'details',jsonb_build_object('max_bytes',p.document_max_bytes,'document_bytes',raw_bytes),'replay',false);
 end if;

 -- A transient byte-budget denial has no receipt: the immutable outbox retries unchanged
 -- after retry-after in the next UTC bucket. Reject it before computing the request hash.
 if usage_row.request_bytes+raw_bytes>p.daily_max_payload_bytes then
  update qsync_private.daily_usage set new_operations=new_operations+1,request_bytes=request_bytes+raw_bytes
   where user_id=owner_id and utc_day=v_utc_day;
  if h.last_pruned_at is null or h.last_pruned_at<current_at-interval '24 hours' then
   perform qsync_private.prune_user(owner_id);
  end if;
  return jsonb_build_object('protocol',2,'status','rejected','operation',p_operation,
   'code','QSYNC_RATE_LIMITED','httpStatus',429,
   'details',jsonb_build_object('retry_after_seconds',retry_after,'max_operations',p.daily_max_operations,
    'max_payload_bytes',p.daily_max_payload_bytes),'replay',false);
 end if;

 request_hash=encode(sha256(convert_to(p_expected_revision||E'\n'||coalesce(p_document_json,'<null>'),'UTF8')),'hex');

 operation_bytes=uuid_send(p_operation);
 if (get_byte(operation_bytes,6)>>4)<>7 or (get_byte(operation_bytes,8)&192)<>128 then
  rejection_code='QSYNC_OPERATION_ID_INVALID'; rejection_status=400;
 else
  operation_ms=(get_byte(operation_bytes,0)::bigint<<40)|(get_byte(operation_bytes,1)::bigint<<32)|
   (get_byte(operation_bytes,2)::bigint<<24)|(get_byte(operation_bytes,3)::bigint<<16)|
   (get_byte(operation_bytes,4)::bigint<<8)|get_byte(operation_bytes,5)::bigint;
  operation_at=to_timestamp(operation_ms::double precision/1000.0);
  if operation_at<current_at-make_interval(days=>p.receipt_retention_days) then
   rejection_code='QSYNC_RECEIPT_EXPIRED'; rejection_status=409;
   rejection_detail='Read the current document and reconcile this saved operation; it was not resent.';
  elsif operation_at>current_at+interval '5 minutes' then
   rejection_code='QSYNC_OPERATION_ID_INVALID'; rejection_status=400;
  end if;
 end if;

 if rejection_code is not null then
  update qsync_private.daily_usage set new_operations=new_operations+1,request_bytes=request_bytes+raw_bytes
   where user_id=owner_id and utc_day=v_utc_day;
  answer=jsonb_build_object('protocol',2,'status','rejected','operation',p_operation,'code',rejection_code,
   'httpStatus',rejection_status,'details',rejection_detail,'replay',false);
  insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response)
   values(owner_id,p_operation,expected,request_hash,answer);
  if h.last_pruned_at is null or h.last_pruned_at<current_at-interval '24 hours' then
   perform qsync_private.prune_user(owner_id);
  end if;
  return answer;
 end if;

 update qsync_private.daily_usage set new_operations=new_operations+1,request_bytes=request_bytes+raw_bytes
  where user_id=owner_id and utc_day=v_utc_day;

 -- Expected data errors are caught in a subtransaction so the attempted write count and its
 -- compact rejection receipt commit, while any partial financial-document changes roll back.
 begin
  if p_document_json is null then raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID',detail='QSYNC_DOCUMENT_JSON'; end if;
  begin parsed_document=p_document_json::jsonb;
  exception when invalid_text_representation then
   raise sqlstate '22023' using message='QSYNC_DOCUMENT_INVALID',detail='QSYNC_DOCUMENT_JSON';
  end;
  doc_bytes=qsync_private.validate_document(parsed_document);
  if h.revision<>expected then
   answer=jsonb_build_object('protocol',2,'status','conflict','revision',h.revision::text,'operation',p_operation,'replay',false);
  else
   if exists(select 1 from public.user_data where user_id=owner_id and
     (data->'version' is distinct from '1'::jsonb or coalesce((data#>>'{settings,schema}')::int,0)>5)) then
    raise sqlstate '22023' using message='QSYNC_UNSUPPORTED_REMOTE';
   end if;
   update public.user_data set data=parsed_document,updated_at=current_at where user_id=owner_id;
   if not found then insert into public.user_data(user_id,data) values(owner_id,parsed_document); end if;
   select * into h from qsync_private.heads where user_id=owner_id;
   answer=jsonb_build_object('protocol',2,'status','applied','revision',h.revision::text,'operation',p_operation,
    'replay',false,'hash',encode(sha256(convert_to(parsed_document::text,'UTF8')),'hex'));
  end if;
  insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response)
   values(owner_id,p_operation,expected,request_hash,answer);
  if h.last_pruned_at is null or h.last_pruned_at<current_at-interval '24 hours' then
   perform qsync_private.prune_user(owner_id);
  end if;
  return answer;
 exception when sqlstate '22023' or sqlstate '22P02' or sqlstate 'PT413' or sqlstate 'PT409' then
  get stacked diagnostics error_state=returned_sqlstate,error_message=message_text,error_detail=pg_exception_detail;
  error_http_status=case error_state when 'PT413' then 413 when 'PT409' then 409 else 400 end;
  answer=jsonb_build_object('protocol',2,'status','rejected','operation',p_operation,'code',error_message,
   'httpStatus',error_http_status,'details',error_detail,'replay',false);
  insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response)
   values(owner_id,p_operation,expected,request_hash,answer);
  if h.last_pruned_at is null or h.last_pruned_at<current_at-interval '24 hours' then
   perform qsync_private.prune_user(owner_id);
  end if;
  return answer;
 end;
end $$;

create function public.qsync_prune_expired(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; owners integer=0; removed bigint=0;
begin
 if auth.role() is distinct from 'service_role' then raise sqlstate '42501' using message='QSYNC_MAINTENANCE_ROLE_REQUIRED'; end if;
 if p_limit is null or p_limit<1 or p_limit>1000 then raise sqlstate '22023' using message='QSYNC_INVALID_LIMIT'; end if;
 for owner_id in
  select user_id from qsync_private.heads
  where last_pruned_at is null or last_pruned_at<clock_timestamp()-interval '24 hours'
  order by last_pruned_at nulls first,user_id
  limit p_limit for update skip locked
 loop
  removed=removed+qsync_private.prune_user(owner_id); owners=owners+1;
 end loop;
 return jsonb_build_object('owners',owners,'rowsPruned',removed);
end $$;

-- Every account in this new project starts protected. Invites remain an Auth configuration gate.
update qsync_private.heads set protected=true,activation_allowed=false,minimum_protocol=2,activated_at=clock_timestamp();

revoke all on public.user_data from anon,service_role;
revoke insert,update,delete,truncate,references,trigger on public.user_data from authenticated;
revoke all on function qsync_private.document_stats(jsonb) from public,anon,authenticated,service_role;
revoke all on function qsync_private.validate_document(jsonb) from public,anon,authenticated,service_role;
revoke all on function qsync_private.prune_user(uuid) from public,anon,authenticated,service_role;
revoke all on function qsync_private.provision_account() from public,anon,authenticated,service_role;
revoke all on function qsync_private.after_write() from public,anon,authenticated,service_role;
revoke all on function public.qsync_read() from public,anon,service_role;
revoke all on function public.qsync_activate() from public,anon,service_role;
revoke all on function public.qsync_write(text,uuid,jsonb) from public,anon,service_role;
revoke all on function public.qsync_write_v2(text,uuid,text) from public,anon,service_role;
revoke all on function public.qsync_prune_expired(integer) from public,anon,authenticated;
grant execute on function public.qsync_read(),public.qsync_activate(),public.qsync_write(text,uuid,jsonb),
 public.qsync_write_v2(text,uuid,text) to authenticated;
grant execute on function public.qsync_prune_expired(integer) to service_role;
notify pgrst,'reload schema';
commit;
