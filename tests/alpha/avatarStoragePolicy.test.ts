import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ownerA = '10000000-0000-4000-8000-000000000001'
const ownerB = '20000000-0000-4000-8000-000000000002'
const migration = await readFile(new URL('../../supabase/alpha-clean-start/supabase/migrations/20261020000600_alpha_avatar_canonical_path.sql', import.meta.url), 'utf8')
const hardeningVerifier = await readFile(new URL('../../supabase/alpha-clean-start/verify_storage_hardening.sql', import.meta.url), 'utf8')
const avatarClient = await readFile(new URL('../../src/profile/avatar.ts', import.meta.url), 'utf8')
const imageEncoder = await readFile(new URL('../../src/image.ts', import.meta.url), 'utf8')

const fixture = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text not null,name text not null);
insert into supabase_migrations.schema_migrations(version,name) values
  ('20261020000100','alpha_base'),
  ('20261020000200','revisioned_sync'),
  ('20261020000300','alpha_clean_start_sync_limits'),
  ('20261020000400','avatars'),
  ('20261020000500','alpha_data_api_gate'),
  ('20261020000600','alpha_avatar_canonical_path');
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select case when position('/' in name)=0 then array[]::text[]
    else array[split_part(name,'/',1)] end
$$;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null,
  file_size_limit bigint not null, allowed_mime_types text[]
);
create table storage.objects (
  id bigint generated always as identity primary key,
  bucket_id text not null references storage.buckets(id), name text not null,
  owner_id text, metadata jsonb,
  unique(bucket_id,name)
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select, insert, update, delete on storage.buckets to anon, authenticated;
grant usage, select on sequence storage.objects_id_seq to anon, authenticated;
insert into storage.buckets values ('avatars','avatars',false,1048576,
  array['image/webp','image/jpeg','image/png']::text[]);
create policy "avatar: leggo la mia" on storage.objects for select to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar: carico la mia" on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar: cambio la mia" on storage.objects for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar: cancello la mia" on storage.objects for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
`

let db

beforeEach(async () => {
  db = new PGlite()
  await db.exec(fixture)
  await db.exec(migration)
})

afterEach(async () => {
  await db?.close()
  db = undefined
})

async function asRole(role, uid, sql) {
  await db.exec('begin;')
  await db.exec(`set local role ${role};`)
  if (uid) await db.query('select set_config($1,$2,true)', ['request.jwt.claim.sub', uid])
  try {
    const result = await db.query(sql)
    await db.exec('commit;')
    return result
  } catch (error) {
    await db.exec('rollback;')
    throw error
  }
}

async function expectPolicyDenied(role, uid, sql) {
  await expect(asRole(role, uid, sql)).rejects.toMatchObject({ code: '42501' })
}

describe('Alpha avatar Storage hardening', () => {
  it('replaces only the original four owner policies and leaves grants/bucket settings unchanged', async () => {
    expect(migration).not.toMatch(/\b(?:grant|revoke)\b/i)
    const policies = await db.query(`
      select policyname, permissive, roles, cmd, qual, with_check
      from pg_policies where schemaname='storage' and tablename in ('objects','buckets')
      order by tablename,policyname
    `)
    expect(policies.rows).toHaveLength(4)
    expect(policies.rows.map(p => [p.policyname, p.cmd, p.permissive, p.roles])).toEqual([
      ['avatar: cambio la mia', 'UPDATE', 'PERMISSIVE', ['authenticated']],
      ['avatar: cancello la mia', 'DELETE', 'PERMISSIVE', ['authenticated']],
      ['avatar: carico la mia', 'INSERT', 'PERMISSIVE', ['authenticated']],
      ['avatar: leggo la mia', 'SELECT', 'PERMISSIVE', ['authenticated']],
    ])
    const canonical = `((bucket_id = 'avatars'::text) AND (name = ((auth.uid())::text || '/avatar.webp'::text)))`
    const policyByName = Object.fromEntries(policies.rows.map(p => [p.policyname, p]))
    expect(policyByName['avatar: leggo la mia'].qual).toBe(canonical)
    expect(policyByName['avatar: carico la mia'].with_check).toBe(canonical)
    expect(policyByName['avatar: cambio la mia'].qual).toBe(canonical)
    expect(policyByName['avatar: cambio la mia'].with_check).toBe(canonical)
    expect(policyByName['avatar: cancello la mia'].qual).toBe(canonical)
    const catalog = await db.query(`
      select
        (select relrowsecurity from pg_class where oid='storage.objects'::regclass) as objects_rls,
        (select relrowsecurity from pg_class where oid='storage.buckets'::regclass) as buckets_rls,
        has_table_privilege('anon','storage.objects','SELECT') as anon_select,
        has_table_privilege('authenticated','storage.objects','INSERT') as auth_insert,
        has_table_privilege('anon','storage.objects','TRUNCATE') as anon_truncate,
        has_table_privilege('authenticated','storage.objects','TRIGGER') as auth_trigger,
        pg_has_role('anon','authenticated','MEMBER') as anon_in_authenticated,
        pg_has_role('authenticated','service_role','MEMBER') as auth_in_service,
        (select rolsuper or rolbypassrls from pg_roles where rolname='authenticated') as auth_role_escalated,
        (select count(*) from pg_policies where schemaname='storage' and tablename='buckets') as bucket_policies
    `)
    expect(catalog.rows[0]).toEqual({
      objects_rls: true, buckets_rls: true, anon_select: true, auth_insert: true,
      anon_truncate: false, auth_trigger: false, anon_in_authenticated: false,
      auth_in_service: false, auth_role_escalated: false, bucket_policies: 0,
    })
    const bucket = await db.query(`select public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars'`)
    expect(bucket.rows[0]).toEqual({
      public: false, file_size_limit: 1048576,
      allowed_mime_types: ['image/webp','image/jpeg','image/png'],
    })
  })

  it('allows the owner canonical path and rejects arbitrary, nested, cross-owner, and non-avatar paths', async () => {
    const own = await asRole('authenticated', ownerA,
      `insert into storage.objects(bucket_id,name,owner_id) values ('avatars','${ownerA}/avatar.webp','${ownerA}') returning name`)
    expect(own.rows).toEqual([{ name: `${ownerA}/avatar.webp` }])
    const read = await asRole('authenticated', ownerA,
      `select name from storage.objects where bucket_id='avatars' order by name`)
    expect(read.rows).toEqual([{ name: `${ownerA}/avatar.webp` }])

    for (const path of [
      `${ownerA}/other.webp`,
      `${ownerA}/nested/avatar.webp`,
      `${ownerA}/avatar.jpg`,
      `${ownerB}/avatar.webp`,
      'public/avatar.webp',
    ]) {
      await expectPolicyDenied('authenticated', ownerA,
        `insert into storage.objects(bucket_id,name) values ('avatars','${path}')`)
    }
  })

  it('protects USING and WITH CHECK for read, update, upsert, copy, move, and delete', async () => {
    await db.query(`
      insert into storage.objects(bucket_id,name,owner_id) values
        ('avatars','${ownerA}/avatar.webp','${ownerA}'),
        ('avatars','${ownerA}/extra.png','${ownerA}'),
        ('avatars','${ownerB}/avatar.webp','${ownerB}')
    `)

    const ownerRows = await asRole('authenticated', ownerA,
      `select name from storage.objects where bucket_id='avatars' order by name`)
    expect(ownerRows.rows).toEqual([{ name: `${ownerA}/avatar.webp` }])

    const otherRows = await asRole('authenticated', ownerB,
      `select name from storage.objects where bucket_id='avatars' and name='${ownerA}/avatar.webp'`)
    expect(otherRows.rows).toEqual([])
    const ownUpdate = await asRole('authenticated', ownerA,
      `update storage.objects set metadata='{"updated":true}' where bucket_id='avatars' and name='${ownerA}/avatar.webp' returning name,metadata`)
    expect(ownUpdate.rows).toEqual([{ name: `${ownerA}/avatar.webp`, metadata: { updated: true } }])
    const ownUpsert = await asRole('authenticated', ownerA,
      `insert into storage.objects(bucket_id,name,owner_id) values ('avatars','${ownerA}/avatar.webp','${ownerA}') on conflict(bucket_id,name) do update set metadata='{"upserted":true}' returning name,metadata`)
    expect(ownUpsert.rows).toEqual([{ name: `${ownerA}/avatar.webp`, metadata: { upserted: true } }])
    await expectPolicyDenied('authenticated', ownerA,
      `update storage.objects set name='${ownerA}/extra.webp' where bucket_id='avatars' and name='${ownerA}/avatar.webp'`)
    await expectPolicyDenied('authenticated', ownerA,
      `update storage.objects set name='${ownerB}/avatar.webp' where bucket_id='avatars' and name='${ownerA}/avatar.webp'`)
    await expectPolicyDenied('authenticated', ownerA,
      `insert into storage.objects(bucket_id,name) values ('avatars','${ownerA}/copy.webp') on conflict(bucket_id,name) do update set owner_id=excluded.owner_id`)
    await expectPolicyDenied('authenticated', ownerA,
      `insert into storage.objects(bucket_id,name,owner_id) select bucket_id,'${ownerA}/copy.webp','${ownerA}' from storage.objects where bucket_id='avatars' and name='${ownerA}/avatar.webp'`)
    await expectPolicyDenied('authenticated', ownerA,
      `insert into storage.objects(bucket_id,name,owner_id) select bucket_id,'${ownerB}/avatar.webp','${ownerA}' from storage.objects where bucket_id='avatars' and name='${ownerA}/avatar.webp'`)

    const otherDelete = await asRole('authenticated', ownerB,
      `delete from storage.objects where bucket_id='avatars' and name='${ownerA}/avatar.webp' returning name`)
    expect(otherDelete.rows).toEqual([])
    const anonRead = await asRole('anon', null,
      `select name from storage.objects where bucket_id='avatars'`)
    expect(anonRead.rows).toEqual([])
    await expectPolicyDenied('anon', null,
      `insert into storage.objects(bucket_id,name) values ('avatars','${ownerA}/avatar.webp')`)

    const unchanged = await asRole('authenticated', ownerA,
      `select name from storage.objects where bucket_id='avatars' and name='${ownerA}/avatar.webp'`)
    expect(unchanged.rows).toEqual([{ name: `${ownerA}/avatar.webp` }])
    const ownerDelete = await asRole('authenticated', ownerA,
      `delete from storage.objects where bucket_id='avatars' and name='${ownerA}/avatar.webp' returning name`)
    expect(ownerDelete.rows).toEqual([{ name: `${ownerA}/avatar.webp` }])
  })

  it('retains the configured WebP/JPEG/PNG allowlist and the 1 MiB cap', async () => {
    const checks = await db.query(`
      select
        allowed_mime_types @> array['image/webp']::text[] as webp,
        allowed_mime_types @> array['image/jpeg']::text[] as jpeg,
        allowed_mime_types @> array['image/png']::text[] as png,
        allowed_mime_types @> array['image/gif']::text[] as gif,
        file_size_limit >= 1048576 as limit_inclusive,
        file_size_limit >= 1048577 as over_limit
      from storage.buckets where id='avatars'
    `)
    expect(checks.rows[0]).toEqual({
      webp: true, jpeg: true, png: true, gif: false, limit_inclusive: true, over_limit: false,
    })
    expect(avatarClient).toContain("userId + '/avatar.webp'")
    expect(avatarClient).toContain('{ upsert: true, contentType: blob.type }')
    expect(imageEncoder).toContain("'image/webp'")
    expect(imageEncoder).toContain("'image/jpeg'")
  })

  it('fails closed if any unexpected Storage policy is present', async () => {
    await db.exec(`create policy unexpected_anon_storage_read on storage.objects for select to anon using (true)`)
    await expect(db.exec(migration)).rejects.toThrow('ALPHA_AVATAR_UNEXPECTED_STORAGE_POLICY')
    await db.exec('rollback;')
    const names = await db.query(`select policyname from pg_policies where schemaname='storage' and tablename='objects' order by policyname`)
    expect(names.rows.map(row => row.policyname)).toContain('unexpected_anon_storage_read')
    expect(names.rows).toHaveLength(5)
  })

  it('fails closed if any policy is present on storage.buckets', async () => {
    await db.exec(`create policy unexpected_bucket_read on storage.buckets for select to anon using (true)`)
    await expect(db.exec(migration)).rejects.toThrow('ALPHA_AVATAR_UNEXPECTED_STORAGE_POLICY')
    await db.exec('rollback;')
    await expect(db.exec(hardeningVerifier)).rejects.toThrow('ALPHA_STORAGE_UNEXPECTED_POLICY_INVENTORY')
    await db.exec('rollback;')
  })

  it('runs the read-only verifier and fails it when an extra policy is present', async () => {
    const passing = await db.exec(hardeningVerifier)
    expect(passing.flatMap(result => result.rows ?? []).some(row => row.result === 'ALPHA_STORAGE_HARDENING_PASS')).toBe(true)

    await db.exec(`create policy unexpected_auth_read on storage.objects for select to authenticated using (true)`)
    await expect(db.exec(hardeningVerifier)).rejects.toThrow('ALPHA_STORAGE_UNEXPECTED_POLICY_INVENTORY')
    await db.exec('rollback;')
  })

  it('fails verification if an application role inherits a privileged role', async () => {
    await db.exec(`create role storage_bypass nologin bypassrls; grant storage_bypass to authenticated`)
    await expect(db.exec(hardeningVerifier)).rejects.toThrow('ALPHA_STORAGE_RLS_OR_ROLE_CONFIGURATION')
    await db.exec('rollback;')
  })
})
