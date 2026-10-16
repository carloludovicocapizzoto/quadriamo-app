-- Le parti di Supabase che le migrazioni usano, ridotte all'essenziale per provarle su Postgres (tests/db.test.ts):
-- ruoli, auth.uid() (dal parametro test.uid), utenti, archivio dei file, programmi (cron) e richieste web (net).
-- is_admin() delle migrazioni viene poi sostituita da una versione che legge il parametro test.admin.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now(),
  last_sign_in_at timestamptz, email_confirmed_at timestamptz);
create schema storage;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id serial, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create schema cron;
create table cron.job (jobid serial, jobname text, command text, schedule text);
create function cron.schedule(a text, b text, c text) returns int language sql as $$ select 1 $$;
create function cron.unschedule(a text) returns bool language sql as $$ select true $$;
create function cron.unschedule(a bigint) returns bool language sql as $$ select true $$;
create function cron.alter_job(job_id integer, schedule text default null) returns void language sql as $$ select $$;
create schema net;
create table net.calls (url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.calls values (url, headers, body); select 1::bigint $$;
create schema extensions;
create extension if not exists pgcrypto schema extensions;
