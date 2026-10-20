-- Revisioned synchronization, protocol 1. Apply once, after reviewed backup/restore and writer inventory.
-- No activation at migration/login; pilot admission is an operator action separate from user consent.
-- No remote services, cron, push, billing or financial document conversion.
begin;
set local lock_timeout = '5s';
do $$ begin
 if current_user <> 'postgres' then
  raise exception 'QSYNC_MIGRATION_OWNER_REQUIRED: run as the reviewed postgres owner, not a client/service role';
 end if;
 if not exists(select 1 from pg_catalog.pg_class where oid='public.user_data'::regclass and relrowsecurity and pg_catalog.pg_get_userbyid(relowner)='postgres') then
  raise exception 'QSYNC_PREREQUISITE: expected user_data owned by postgres with RLS enabled';
 end if;
 if exists(select 1 from pg_catalog.pg_namespace where nspname='qsync_private')
  or pg_catalog.to_regprocedure('public.qsync_read()') is not null
  or pg_catalog.to_regprocedure('public.qsync_activate()') is not null
  or pg_catalog.to_regprocedure('public.qsync_write(text,uuid,jsonb)') is not null then
  raise exception 'QSYNC_ALREADY_PRESENT: inspect applied migration history; do not overwrite';
 end if;
end $$;
lock table public.user_data in share row exclusive mode;
create schema qsync_private;
revoke all on schema qsync_private from public;
create table qsync_private.heads (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 protected boolean not null default false,
 activation_allowed boolean not null default false,
 paused boolean not null default false,
 minimum_protocol integer not null default 1 check(minimum_protocol>=1),
 activated_at timestamptz
);
create table qsync_private.history (
 user_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null,
 document jsonb,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,revision)
);
create table qsync_private.receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation uuid not null,
 expected_revision bigint not null,
 document jsonb not null,
 response jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,operation)
);
alter table qsync_private.heads enable row level security;
alter table qsync_private.history enable row level security;
alter table qsync_private.receipts enable row level security;
insert into qsync_private.heads(user_id,revision) select user_id,1 from public.user_data;
insert into qsync_private.history(user_id,revision,document) select user_id,1,data from public.user_data;
revoke all on all tables in schema qsync_private from public,anon,authenticated,service_role;

-- The argument identifies the actual invoker of the trigger. Calling this helper directly
-- grants no write capability and changes no authorization state. The schema is NOT exposed.
create function qsync_private.guard_owner(owner_id uuid, actor text, deleting boolean)
returns void language plpgsql security definer set search_path='' as $$
declare h qsync_private.heads;
begin
 if deleting and not exists(select 1 from auth.users where id=owner_id) then return; end if;
 if auth.uid() is distinct from owner_id and (auth.uid() is not null or actor <> 'postgres') then
  raise sqlstate '42501' using message='QSYNC_OWNER_MISMATCH';
 end if;
 insert into qsync_private.heads(user_id) values(owner_id) on conflict do nothing;
 select * into h from qsync_private.heads where user_id=owner_id for update;
 if h.protected and actor <> 'postgres' then
  raise sqlstate 'PT409' using message='QSYNC_UPGRADE_REQUIRED',
    detail='Read/export your local copy. A compatible client is required to write.';
 end if;
end $$;
revoke all on function qsync_private.guard_owner(uuid,text,boolean) from public;
grant usage on schema qsync_private to authenticated,service_role;
grant execute on function qsync_private.guard_owner(uuid,text,boolean) to authenticated,service_role;

create function qsync_private.before_write() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.user_id is distinct from old.user_id then
  raise sqlstate '42501' using message='QSYNC_OWNER_IMMUTABLE';
 end if;
 perform qsync_private.guard_owner(case when TG_OP='DELETE' then old.user_id else new.user_id end,current_user,TG_OP='DELETE');
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
revoke all on function qsync_private.before_write() from public;
create trigger qsync_before_write before insert or update or delete on public.user_data
for each row execute function qsync_private.before_write();

create function qsync_private.after_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; n bigint;
begin
 owner_id=case when TG_OP='DELETE' then old.user_id else new.user_id end;
 if not exists(select 1 from auth.users where id=owner_id) then return null; end if;
 if TG_OP='UPDATE' and new.data is not distinct from old.data then return null; end if;
 update qsync_private.heads set revision=revision+1 where user_id=owner_id returning revision into n;
 insert into qsync_private.history(user_id,revision,document)
 values(owner_id,n,case when TG_OP='DELETE' then null else new.data end);
 return null;
end $$;
revoke all on function qsync_private.after_write() from public;
create trigger qsync_after_write after insert or update or delete on public.user_data
for each row execute function qsync_private.after_write();

create function public.qsync_read() returns jsonb
language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then null else jsonb_build_object(
 'protocol',coalesce(h.minimum_protocol,1),'revision',coalesce(h.revision,0)::text,
 'mode',case when h.paused then 'paused' when coalesce(h.protected,false) then 'protected' else 'legacy' end,
 'document',u.data,'activationAllowed',coalesce(h.activation_allowed,false)) end
 from (select auth.uid() as id) a
 left join qsync_private.heads h on h.user_id=a.id
 left join public.user_data u on u.user_id=a.id
$$;

-- Operator admission and explicit user opt-in are BOTH required. No activation on read/login.
create function public.qsync_activate() returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid=auth.uid(); h qsync_private.heads;
begin
 if owner_id is null then raise sqlstate '42501' using message='QSYNC_AUTH_REQUIRED'; end if;
 insert into qsync_private.heads(user_id) values(owner_id) on conflict do nothing;
 select * into h from qsync_private.heads where user_id=owner_id for update;
 if not h.protected and not h.activation_allowed then
  raise sqlstate 'PT409' using message='QSYNC_ACTIVATION_NOT_ENABLED',
   detail='Your local changes are preserved. This account has not been admitted to the pilot.';
 end if;
 perform 1 from public.user_data where user_id=owner_id for update;
 update qsync_private.heads set protected=true,activated_at=coalesce(activated_at,clock_timestamp()) where user_id=owner_id;
 return public.qsync_read();
end $$;

create function public.qsync_write(p_expected_revision text,p_operation uuid,p_document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid=auth.uid(); h qsync_private.heads; r qsync_private.receipts; expected bigint; answer jsonb;
begin
 if owner_id is null then raise sqlstate '42501' using message='QSYNC_AUTH_REQUIRED'; end if;
 if p_expected_revision is null or p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$' or p_operation is null then
  raise sqlstate '22023' using message='QSYNC_INVALID_REQUEST';
 end if;
 expected=p_expected_revision::bigint;
 if p_document is null or jsonb_typeof(p_document)<>'object' or p_document->'version' is distinct from '1'::jsonb
   or coalesce(p_document->'demo','false'::jsonb)<>'false'::jsonb
   or jsonb_typeof(p_document->'settings') is distinct from 'object'
   or jsonb_typeof(p_document#>'{settings,buckets}') is distinct from 'array'
   or jsonb_typeof(p_document#>'{settings,categories}') is distinct from 'array'
   or coalesce((p_document#>>'{settings,schema}')::int,0)>5
   or (jsonb_typeof(p_document#>'{settings,events}') is distinct from 'array' and jsonb_typeof(p_document#>'{settings,recurring}') is distinct from 'array')
   or jsonb_typeof(p_document->'transactions') is distinct from 'array' then
  raise sqlstate '22023' using message='QSYNC_UNSUPPORTED_DOCUMENT';
 end if;
 select * into h from qsync_private.heads where user_id=owner_id for update;
 if not found or not h.protected then raise sqlstate 'PT409' using message='QSYNC_NOT_ACTIVATED'; end if;
 if h.paused then raise sqlstate 'PT503' using message='QSYNC_PAUSED'; end if;
 if h.minimum_protocol>1 then raise sqlstate 'PT409' using message='QSYNC_UPGRADE_REQUIRED'; end if;
 select * into r from qsync_private.receipts where user_id=owner_id and operation=p_operation;
 if found then
  if r.expected_revision<>expected or r.document is distinct from p_document then
   raise sqlstate '22023' using message='QSYNC_OPERATION_REUSED';
  end if;
  return r.response || jsonb_build_object('replay',true);
 end if;
 if h.revision<>expected then
  answer=jsonb_build_object('status','conflict','revision',h.revision::text,'operation',p_operation,'replay',false);
 else
  if exists(select 1 from public.user_data where user_id=owner_id and
   (data->'version' is distinct from '1'::jsonb or coalesce((data#>>'{settings,schema}')::int,0)>5)) then
   raise sqlstate '22023' using message='QSYNC_UNSUPPORTED_REMOTE';
  end if;
  -- Serialized by owner head lock. An absent row is inserted, never blindly upserted.
  update public.user_data set data=p_document,updated_at=clock_timestamp() where user_id=owner_id;
  if not found then insert into public.user_data(user_id,data) values(owner_id,p_document); end if;
  select * into h from qsync_private.heads where user_id=owner_id;
  answer=jsonb_build_object('status','applied','revision',h.revision::text,'operation',p_operation,'replay',false,
   'hash',encode(sha256(convert_to(p_document::text,'UTF8')),'hex'));
 end if;
 insert into qsync_private.receipts(user_id,operation,expected_revision,document,response)
 values(owner_id,p_operation,expected,p_document,answer);
 return answer;
end $$;
revoke all on function public.qsync_read(),public.qsync_activate(),public.qsync_write(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.qsync_read(),public.qsync_activate(),public.qsync_write(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
