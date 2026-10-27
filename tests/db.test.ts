// Il database su Postgres vero (PGlite), con le parti di Supabase ridotte all'essenziale (tests/db/supabase.sql):
// tutte le migrazioni si applicano in ordine, e le regole di accesso fanno quello che promettono.
// Chi prova: anon (senza account), authenticated (con test.uid = l'utente), l'amministratore (test.admin = on).
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { createOperationId } from '../src/sync/protocol'

const DIR = 'supabase/migrations'
const A = '30000000-0000-4000-8000-00000000000a', B = '30000000-0000-4000-8000-00000000000b', C = '30000000-0000-4000-8000-00000000000c'
const HOME = '40000000-0000-4000-8000-000000000001', OTHER = '40000000-0000-4000-8000-000000000002'
let db: PGlite, legacy: PGlite

/** Esegue come un ruolo (e un utente); dice quante righe ha toccato o il motivo del rifiuto. */
async function asDatabase(target: PGlite, role: 'anon' | 'authenticated' | 'service_role', uid: string | null, sql: string): Promise<number | string> {
  await target.exec(`set role ${role}; set test.uid = '${uid ?? ''}'; set test.role = '${role}'`)
  try { const r = await target.query(sql); return r.affectedRows || r.rows.length }
  catch (e) { return (e as Error).message }
  finally { await target.exec(`reset role; set test.uid = ''; set test.role = ''`) }
}
const as = (role: 'anon' | 'authenticated' | 'service_role', uid: string | null, sql: string) => asDatabase(db, role, uid, sql)
const asLegacy = (role: 'anon' | 'authenticated' | 'service_role', uid: string | null, sql: string) => asDatabase(legacy, role, uid, sql)
const count = async (role: 'anon' | 'authenticated', uid: string | null, table: string) => as(role, uid, `select 1 from ${table}`)
const countLegacy = async (role: 'anon' | 'authenticated', uid: string | null, table: string) => asLegacy(role, uid, `select 1 from ${table}`)
async function rowsAs(target: PGlite, role: 'anon' | 'authenticated' | 'service_role', uid: string | null, sql: string): Promise<Record<string, unknown>[] | string> {
  await target.exec(`set role ${role}; set test.uid = '${uid ?? ''}'; set test.role = '${role}'`)
  try { return (await target.query(sql)).rows as Record<string, unknown>[] }
  catch (e) { return (e as Error).message }
  finally { await target.exec(`reset role; set test.uid = ''; set test.role = ''`) }
}

async function install(target: PGlite, through?: string) {
  await target.exec(readFileSync('tests/db/supabase.sql', 'utf8'))
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()) {
    // Il protocollo deve revocare anche grant ereditati dai default ACL del progetto ospitante.
    if (f.startsWith('0030_')) await target.exec('alter default privileges for role postgres in schema public grant execute on functions to service_role')
    try { await target.exec(readFileSync(`${DIR}/${f}`, 'utf8')) } catch (e) { throw new Error(`${f}: ${(e as Error).message}`) }
    if (through && f === through) break
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await install(db)
  legacy = new PGlite({ extensions: { pgcrypto } })
  await install(legacy, '0030_revisioned_sync.sql')
  await db.exec(`
    create or replace function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = 'on' $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant all on storage.objects to anon, authenticated; grant usage on sequence storage.objects_id_seq to anon, authenticated;
    insert into auth.users (id, email) values ('${A}', 'anna@x.it'), ('${B}', 'bruno@x.it'), ('${C}', 'carla@x.it');
    insert into public.user_data (user_id, data) values ('${A}', '{"budget": 1}');
    insert into public.shared_budgets (id, name, created_by) values ('${HOME}', 'Casa', '${A}'), ('${OTHER}', 'Altro', '${C}');
    insert into public.shared_members (budget_id, user_id, display_name) values
      ('${HOME}', '${A}', 'Anna'), ('${HOME}', '${B}', 'Bruno'), ('${OTHER}', '${C}', 'Carla'), ('${OTHER}', '${B}', 'Bruno');
    insert into public.client_errors (message) values ('errore');
    insert into public.usage_sessions (session_id, device_id, seconds, screens, path, actions) values (gen_random_uuid(), gen_random_uuid(), 10, '{}', '[]', '{}');
    insert into public.tester_reports (id, kind, message) values (gen_random_uuid(), 'bug', 'una prova');`)
}, 60_000)

describe('database: migrazioni e regole di accesso', () => {
  it('ogni tabella ha le regole per riga attive', async () => {
    const r = await db.query<{ relname: string }>(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)
    expect(r.rows.map(x => x.relname)).toEqual([])
  })

  it('0030: il pilota richiede ammissione dell’operatore e consenso dell’utente', async () => {
    const user = '30000000-0000-4000-8000-00000000000d'
    await legacy.exec(`insert into auth.users(id,email) values ('${user}','pilot@synthetic.invalid')`)
    expect(await asLegacy('authenticated', user, 'select public.qsync_activate()')).toMatch(/QSYNC_ACTIVATION_NOT_ENABLED/)
    await legacy.exec(`set test.uid='${user}'`)
    const read = await legacy.query<{ value: { activationAllowed: boolean; mode: string } }>('select public.qsync_read() as value')
    expect(read.rows[0].value).toMatchObject({ activationAllowed: false, mode: 'legacy' })
    await legacy.exec(`set test.uid=''; insert into qsync_private.heads(user_id,activation_allowed) values ('${user}',true)`)
    expect(await asLegacy('authenticated', user, 'select public.qsync_activate()')).toBe(1)
    expect((await legacy.query<{ protected: boolean }>(`select protected from qsync_private.heads where user_id='${user}'`)).rows[0].protected).toBe(true)
  })

  it('0030: creazione CAS, risposta persa e vecchio writer non duplicano o sostituiscono il documento', async () => {
    const user = '30000000-0000-4000-8000-00000000000e'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    const operation = '50000000-0000-4000-8000-000000000001'
    await legacy.exec(`insert into auth.users(id,email) values ('${user}','cas@synthetic.invalid');
      insert into qsync_private.heads(user_id,activation_allowed) values ('${user}',true)`)
    expect(await asLegacy('authenticated', user, 'select public.qsync_activate()')).toBe(1)
    const write = `select public.qsync_write('0','${operation}','${JSON.stringify(document)}'::jsonb)`
    expect(await asLegacy('authenticated', user, write)).toBe(1)
    expect(await asLegacy('authenticated', user, write)).toBe(1)
    expect((await legacy.query<{ n: number }>(`select count(*)::int n from qsync_private.history where user_id='${user}'`)).rows[0].n).toBe(1)
    expect(await asLegacy('authenticated', user, `update public.user_data set data='{}' where user_id='${user}'`)).toMatch(/QSYNC_UPGRADE_REQUIRED/)
    expect(await asLegacy('authenticated', user, write.replace('"transactions":[]', '"transactions":[{}]'))).toMatch(/QSYNC_OPERATION_REUSED/)
    expect(await countLegacy('authenticated', A, 'qsync_private.receipts')).toMatch(/permission denied/)
    expect((await legacy.query<{ data: unknown }>(`select data from public.user_data where user_id='${user}'`)).rows[0].data).toEqual(document)
  })

  it('0030: anon non può chiamare RPC e i metadati privati hanno RLS senza privilegi client', async () => {
    expect(await asLegacy('anon', null, 'select public.qsync_read()')).toMatch(/permission denied/)
    const r = await legacy.query<{ n: number }>(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='qsync_private' and c.relkind='r' and c.relrowsecurity`)
    expect(r.rows[0].n).toBe(3)
    expect(await countLegacy('authenticated', B, 'qsync_private.heads')).toMatch(/permission denied/)
    expect((await legacy.query<{ allowed: boolean }>(`select has_function_privilege('service_role','public.qsync_write(text,uuid,jsonb)','execute') as allowed`)).rows[0].allowed).toBe(false)
  })

  it('0031: rifiuta in modo atomico un database storico invece di compattare account esistenti', async () => {
    await legacy.exec(`insert into auth.users(id,email) values ('30000000-0000-4000-8000-00000000001c','legacy@synthetic.invalid')`)
    await expect(legacy.exec(readFileSync(`${DIR}/0031_alpha_clean_start_sync_limits.sql`, 'utf8'))).rejects.toThrow(/QSYNC_ALPHA_NOT_EMPTY/)
    await legacy.exec('rollback')
    expect((await legacy.query(`select to_regprocedure('public.qsync_write_v2(text,uuid,text)') as fn`)).rows[0].fn).toBeNull()
  })

  it('0031: i nuovi account nascono protetti sul protocollo 2 e solo la RPC revisionata scrive', async () => {
    const user = '30000000-0000-4000-8000-00000000001d', other = '30000000-0000-4000-8000-00000000001e'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    await db.exec(`insert into auth.users(id,email) values ('${user}','alpha-a@synthetic.invalid'),('${other}','alpha-b@synthetic.invalid')`)
    const head = await db.query<{ protected: boolean; minimum_protocol: number; revision: string }>(
      `select protected,minimum_protocol,revision::text from qsync_private.heads where user_id='${user}'`)
    expect(head.rows[0]).toMatchObject({ protected: true, minimum_protocol: 2, revision: '0' })
    const read = await rowsAs(db, 'authenticated', user, 'select public.qsync_read() as value')
    expect(typeof read).not.toBe('string')
    expect((read as Record<string, unknown>[])[0].value).toMatchObject({ protocol: 2, mode: 'protected', revision: '0', document: null })

    const operation = createOperationId(), write = `select public.qsync_write_v2('0','${operation}','${JSON.stringify(document)}') as value`
    const first = await rowsAs(db, 'authenticated', user, write), replay = await rowsAs(db, 'authenticated', user, write)
    expect((first as Record<string, unknown>[])[0].value).toMatchObject({ protocol: 2, status: 'applied', revision: '1', replay: false })
    expect((replay as Record<string, unknown>[])[0].value).toMatchObject({ status: 'applied', revision: '1', replay: true })
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.history where user_id='${user}'`)).rows[0].n).toBe(1)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}'`)).rows[0].n).toBe(1)
    expect((await db.query<{ n: number }>(`select count(*)::int n from information_schema.columns where table_schema='qsync_private' and ((table_name='history' and column_name='document') or (table_name='receipts' and column_name='document'))`)).rows[0].n).toBe(0)

    expect(await as('authenticated', user, `insert into public.user_data(user_id,data) values ('${other}','${JSON.stringify(document)}'::jsonb)`)).toMatch(/permission denied|not have permission/)
    expect(await as('service_role', user, `update public.user_data set data='{}' where user_id='${user}'`)).toMatch(/permission denied|not have permission/)
    expect(await as('authenticated', other, `select public.qsync_write('0','${createOperationId()}','${JSON.stringify(document)}'::jsonb)`)).toMatch(/QSYNC_UPGRADE_REQUIRED/)
    expect(await count('authenticated', other, 'public.user_data')).toBe(0)
    expect((await db.query<{ execute: boolean }>(`select has_function_privilege('service_role','public.qsync_write_v2(text,uuid,text)','execute') execute`)).rows[0].execute).toBe(false)
    expect((await db.query<{ execute: boolean }>(`select has_function_privilege('anon','public.qsync_write_v2(text,uuid,text)','execute') execute`)).rows[0].execute).toBe(false)
    expect((await db.query<{ execute: boolean }>(`select has_function_privilege('service_role','public.qsync_prune_expired(integer)','execute') execute`)).rows[0].execute).toBe(true)
    expect((await db.query<{ reloptions: string[] }>(`select reloptions from pg_class where oid='qsync_private.daily_usage'::regclass`)).rows[0].reloptions)
      .toEqual(expect.arrayContaining(['fillfactor=70', 'autovacuum_vacuum_threshold=50', 'autovacuum_vacuum_scale_factor=0.05']))
  })

  it('0031: dimensioni e struttura vengono validate prima di qualsiasi revisione', async () => {
    const user = '30000000-0000-4000-8000-00000000001f'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    await db.exec(`insert into auth.users(id,email) values ('${user}','shape@synthetic.invalid')`)
    const invalid = [{ ...document, transactions: [{}] }, { ...document, settings: { ...document.settings, schema: '5' } }]
    for (const value of invalid) {
      const result = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('0','${createOperationId()}','${JSON.stringify(value)}') as value`)
      expect((result as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_DOCUMENT_INVALID', httpStatus: 400 })
    }
    const oversized = { ...document, padding: 'x'.repeat(1_048_577) }, oversizedOperation = createOperationId()
    const result = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('0','${oversizedOperation}','${JSON.stringify(oversized)}') as value`)
    expect((result as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_DOCUMENT_TOO_LARGE', httpStatus: 413 })
    expect((await db.query<{ revision: string }>(`select revision::text from qsync_private.heads where user_id='${user}'`)).rows[0].revision).toBe('0')
    expect(await count('authenticated', user, 'public.user_data')).toBe(0)
    expect((await db.query<{ new_operations: number }>(`select new_operations from qsync_private.daily_usage where user_id='${user}'`)).rows[0].new_operations).toBe(3)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}'`)).rows[0].n).toBe(2)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}' and operation='${oversizedOperation}'`)).rows[0].n).toBe(0)
  })

  it('0031: replay idempotenti non consumano quota e il blocco atomico non crea ricevute', async () => {
    const user = '30000000-0000-4000-8000-000000000020'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    await db.exec(`insert into auth.users(id,email) values ('${user}','quota@synthetic.invalid')`)
    const operation = createOperationId(), sql = `select public.qsync_write_v2('0','${operation}','${JSON.stringify(document)}')`
    await rowsAs(db, 'authenticated', user, sql)
    await rowsAs(db, 'authenticated', user, sql)
    expect((await db.query<{ n: number }>(`select new_operations n from qsync_private.daily_usage where user_id='${user}'`)).rows[0].n).toBe(1)
    await db.exec(`update qsync_private.daily_usage set new_operations=200 where user_id='${user}'`)
    const limited = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('1','${createOperationId()}','${JSON.stringify(document)}') as value`)
    expect((limited as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_RATE_LIMITED', httpStatus: 429 })
    expect((await db.query<{ n: number }>(`select new_operations n from qsync_private.daily_usage where user_id='${user}'`)).rows[0].n).toBe(200)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}'`)).rows[0].n).toBe(1)
    expect((await db.query<{ revision: string }>(`select revision::text from qsync_private.heads where user_id='${user}'`)).rows[0].revision).toBe('1')
    expect(await as('authenticated', user, sql)).toBe(1)
    expect((await db.query<{ n: number }>(`select new_operations n from qsync_private.daily_usage where user_id='${user}'`)).rows[0].n).toBe(200)
  })

  it('0031: i rifiuti precoci avviano la pulizia dei bucket giornalieri scaduti', async () => {
    const user = '30000000-0000-4000-8000-000000000023'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [], padding: 'x'.repeat(1_048_577) }
    await db.exec(`insert into auth.users(id,email) values ('${user}','early-prune@synthetic.invalid');
      insert into qsync_private.daily_usage(user_id,utc_day,new_operations,request_bytes)
        select '${user}',(clock_timestamp() at time zone 'UTC')::date-g,1,100 from generate_series(0,100) g`)
    const result = await rowsAs(db, 'authenticated', user,
      `select public.qsync_write_v2('0','${createOperationId()}','${JSON.stringify(document)}') as value`)
    expect((result as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_DOCUMENT_TOO_LARGE', httpStatus: 413 })
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.daily_usage where user_id='${user}'`)).rows[0].n).toBe(90)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}'`)).rows[0].n).toBe(0)
    expect((await db.query<{ at: string }>(`select last_pruned_at::text at from qsync_private.heads where user_id='${user}'`)).rows[0].at).toBeTruthy()
  })

  it('0031: il rifiuto temporaneo per byte conserva l’outbox e consente lo stesso UUID nel bucket UTC successivo', async () => {
    const user = '30000000-0000-4000-8000-000000000022'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    const operation = createOperationId(), payload = JSON.stringify(document)
    await db.exec(`insert into auth.users(id,email) values ('${user}','byte-quota@synthetic.invalid');
      insert into qsync_private.daily_usage(user_id,utc_day,request_bytes)
        values ('${user}',(clock_timestamp() at time zone 'UTC')::date,33554431)`)
    const denied = await rowsAs(db, 'authenticated', user,
      `select public.qsync_write_v2('0','${operation}','${payload}') as value`)
    expect((denied as Record<string, unknown>[])[0].value).toMatchObject({
      status: 'rejected', code: 'QSYNC_RATE_LIMITED', httpStatus: 429, replay: false,
    })
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}' and operation='${operation}'`)).rows[0].n).toBe(0)
    expect((await db.query<{ revision: string }>(`select revision::text from qsync_private.heads where user_id='${user}'`)).rows[0].revision).toBe('0')
    expect((await db.query<{ n: number }>(`select new_operations n from qsync_private.daily_usage where user_id='${user}' and utc_day=(clock_timestamp() at time zone 'UTC')::date`)).rows[0].n).toBe(1)

    await db.exec(`update qsync_private.daily_usage set utc_day=utc_day-1 where user_id='${user}' and utc_day=(clock_timestamp() at time zone 'UTC')::date`)
    const retried = await rowsAs(db, 'authenticated', user,
      `select public.qsync_write_v2('0','${operation}','${payload}') as value`)
    expect((retried as Record<string, unknown>[])[0].value).toMatchObject({ status: 'applied', revision: '1', replay: false })
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}' and operation='${operation}'`)).rows[0].n).toBe(1)
    expect((await db.query<{ n: number }>(`select new_operations n from qsync_private.daily_usage where user_id='${user}' and utc_day=(clock_timestamp() at time zone 'UTC')::date`)).rows[0].n).toBe(1)
    expect((await db.query<{ revision: string }>(`select revision::text from qsync_private.heads where user_id='${user}'`)).rows[0].revision).toBe('1')
  })

  it('0031: la pulizia mantiene almeno 90 giorni o le ultime 1000 revisioni e rifiuta i replay ormai scaduti', async () => {
    const user = '30000000-0000-4000-8000-000000000021', retained = createOperationId(Date.now() - 100 * 86_400_000)
    const expired = createOperationId(Date.now() - 101 * 86_400_000)
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    const requestHash = `encode(sha256(convert_to('0'||E'\\n'||'${JSON.stringify(document)}','UTF8')),'hex')`
    await db.exec(`insert into auth.users(id,email) values ('${user}','retention@synthetic.invalid');
      update qsync_private.heads set revision=1001,last_pruned_at=null where user_id='${user}';
      insert into qsync_private.history(user_id,revision,document_hash,recorded_at)
        select '${user}',g,repeat('a',64),clock_timestamp()-interval '100 days' from generate_series(1,1001) g;
      insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response,recorded_at)
        values ('${user}','${retained}',0,${requestHash},jsonb_build_object('protocol',2,'status','applied','revision','1','operation','${retained}','replay',false),clock_timestamp()-interval '100 days'),
          ('${user}','${expired}',1000,encode(sha256(convert_to('1000'||E'\\n'||'${JSON.stringify(document)}','UTF8')),'hex'),jsonb_build_object('protocol',2,'status','applied','revision','1001','operation','${expired}','replay',false),clock_timestamp()-interval '101 days');
      insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response,recorded_at)
        select '${user}',md5(g::text)::uuid,0,repeat(md5(g::text),2),jsonb_build_object('protocol',2,'status','conflict','revision','1001','operation',md5(g::text)::uuid,'replay',false),clock_timestamp()-interval '89 days'
        from generate_series(1,999) g;
      insert into qsync_private.daily_usage(user_id,utc_day,new_operations,request_bytes)
        select '${user}',(clock_timestamp() at time zone 'UTC')::date-g,1,100 from generate_series(0,90) g`)
    const prune = await rowsAs(db, 'service_role', null, 'select public.qsync_prune_expired(1000) as value')
    expect(Number((prune as Record<string, unknown>[])[0].value && ((prune as Record<string, unknown>[])[0].value as { owners: number }).owners)).toBeGreaterThan(0)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}'`)).rows[0].n).toBe(1000)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.history where user_id='${user}'`)).rows[0].n).toBe(1000)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.daily_usage where user_id='${user}'`)).rows[0].n).toBe(90)

    const replay = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('0','${retained}','${JSON.stringify(document)}') as value`)
    expect((replay as Record<string, unknown>[])[0].value).toMatchObject({ status: 'applied', revision: '1', replay: true })
    await db.exec(`update qsync_private.heads set revision=1001 where user_id='${user}'`)
    const expiredWrite = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('1000','${expired}','${JSON.stringify(document)}') as value`)
    expect((expiredWrite as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_RECEIPT_EXPIRED', httpStatus: 409 })
    const expiredReplay = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('1000','${expired}','${JSON.stringify(document)}') as value`)
    expect((expiredReplay as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_RECEIPT_EXPIRED', replay: true })
    expect((await db.query<{ revision: string }>(`select revision::text from qsync_private.heads where user_id='${user}'`)).rows[0].revision).toBe('1001')
  })

  it('0031: il margine di clock conserva ACK al confine dei 90 giorni e poi rifiuta il replay potato', async () => {
    const user = '30000000-0000-4000-8000-000000000024'
    const retained = createOperationId(Date.now() - 90 * 86_400_000 + 120_000)
    const expired = createOperationId(Date.now() - 90 * 86_400_000 - 60_000)
    const payload = JSON.stringify({ version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] })
    await db.exec(`insert into auth.users(id,email) values ('${user}','clock-grace@synthetic.invalid');
      insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response,recorded_at)
        select '${user}',md5('grace-'||g)::uuid,0,repeat('a',64),'{}'::jsonb,clock_timestamp()-interval '1 hour' from generate_series(1,1000) g;
      insert into qsync_private.receipts(user_id,operation,expected_revision,request_hash,response,recorded_at)
        select '${user}',operation,0,encode(sha256(convert_to('0'||E'\\n'||'${payload}','UTF8')),'hex'),
          jsonb_build_object('protocol',2,'status','applied','revision','0','operation',operation,'replay',false),recorded_at
        from (values ('${retained}'::uuid,clock_timestamp()-interval '90 days 2 minutes'),
          ('${expired}'::uuid,clock_timestamp()-interval '90 days 6 minutes')) seeded(operation,recorded_at)`)
    await rowsAs(db, 'service_role', null, 'select public.qsync_prune_expired(1000)')
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.receipts where user_id='${user}'`)).rows[0].n).toBe(1001)
    const replay = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('0','${retained}','${payload}') as value`)
    expect((replay as Record<string, unknown>[])[0].value).toMatchObject({ status: 'applied', revision: '0', replay: true })
    const late = await rowsAs(db, 'authenticated', user, `select public.qsync_write_v2('0','${expired}','${payload}') as value`)
    expect((late as Record<string, unknown>[])[0].value).toMatchObject({ status: 'rejected', code: 'QSYNC_RECEIPT_EXPIRED' })
    expect((await db.query<{ revision: string }>(`select revision::text from qsync_private.heads where user_id='${user}'`)).rows[0].revision).toBe('0')
    expect(await count('authenticated', user, 'public.user_data')).toBe(0)
  })

  it('i dati di un utente li legge solo lui', async () => {
    expect(await count('authenticated', A, 'public.user_data')).toBe(1)
    expect(await count('authenticated', B, 'public.user_data')).toBe(0)
    expect(await count('anon', null, 'public.user_data')).toMatch(/permission denied/)
  })

  it('errori, sessioni e segnalazioni: chiunque li manda, li legge solo l\'amministratore', async () => {
    for (const t of ['public.client_errors', 'public.usage_sessions', 'public.tester_reports']) {
      for (const [role, uid] of [['anon', null], ['authenticated', A]] as const) {
        const n = await count(role, uid, t)
        expect(n === 0 || /permission denied/.test(String(n)), `${t} letto da ${role}`).toBe(true)
      }
    }
    await db.exec(`set test.admin = 'on'`)
    expect(await count('anon', null, 'public.tester_reports')).toBe(1)
    await db.exec(`set test.admin = 'off'`)
  })

  it('segnalazioni: allegati solo con l\'accesso e solo nella propria cartella', async () => {
    const report = (files: string) => `insert into public.tester_reports (id, kind, message, attachments) values (gen_random_uuid(), 'idea', 'idea di prova', ${files})`
    expect(await as('anon', null, report(`'{}'`))).toBe(1)
    expect(await as('anon', null, report(`'{x/1.png}'`))).toMatch(/row-level security/)
    expect(await as('authenticated', A, report(`'{${A}/r/1.png}'`))).toBe(1)
    const upload = (path: string) => `insert into storage.objects (bucket_id, name) values ('reports', '${path}')`
    expect(await as('authenticated', A, upload(`${A}/r/1.png`))).toBe(1)
    expect(await as('authenticated', A, upload(`${B}/r/1.png`))).toMatch(/row-level security/)
    expect(await as('anon', null, upload(`${A}/r/2.png`))).toMatch(/row-level security/)
  })

  it('le funzioni dell\'area amministratore rifiutano chi non lo è', async () => {
    const fns = await db.query<{ proname: string }>(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'admin\\_%' and p.proname <> 'admin_name' and has_function_privilege('anon', p.oid, 'execute')`)
    expect(fns.rows.length).toBeGreaterThan(10)
    for (const { proname } of fns.rows) expect(await as('anon', null, `select public.${proname}()`), proname).toMatch(/not allowed/)
  })

  it('budget comuni: ognuno cambia solo quello che l\'app permette (0028)', async () => {
    const X = `budget_id = '${HOME}'`
    expect(await as('authenticated', B, `update public.shared_budgets set created_by = '${B}' where id = '${HOME}'`)).toMatch(/permission denied/)
    expect(await as('authenticated', B, `update public.shared_budgets set name = 'Casa nostra' where id = '${HOME}'`)).toBe(1)
    expect(await as('authenticated', B, `update public.shared_members set budget_id = '${OTHER}' where ${X} and user_id = '${A}'`)).toMatch(/permission denied/)
    expect(await as('authenticated', B, `update public.shared_members set user_id = '${C}' where ${X} and user_id = '${A}'`)).toMatch(/permission denied/)
    expect(await as('authenticated', B, `update public.shared_members set income = 1 where ${X} and user_id = '${A}'`)).toMatch(/solo la persona interessata/)
    expect(await as('authenticated', B, `update public.shared_members set share = 40 where ${X} and user_id = '${A}'`)).toBe(1)
    expect(await as('authenticated', B, `update public.shared_members set income = 1500 where ${X} and user_id = '${B}'`)).toBe(1)
    expect(await as('authenticated', C, `update public.shared_members set share = 1 where ${X} and user_id = '${A}'`)).toBe(0)
  })

  it('una nuova segnalazione chiama la funzione della mail con il segreto del programma del mattino (0027)', async () => {
    await db.exec(`delete from net.calls; insert into cron.job (jobname, command) values ('quadriamo-morning-spend',
      $c$select net.http_post(url := 'https://abc.supabase.co/functions/v1/send-push', headers := '{"Content-Type": "application/json", "x-cron-secret": "s3gr3t0"}'::jsonb)$c$)`)
    await as('anon', null, `insert into public.tester_reports (id, kind, message) values (gen_random_uuid(), 'bug', 'mail di prova')`)
    const call = (await db.query<{ url: string; headers: Record<string, string> }>('select url, headers from net.calls')).rows[0]
    expect(call.url).toBe('https://abc.supabase.co/functions/v1/report-email')
    expect(call.headers['x-cron-secret']).toBe('s3gr3t0')
  })

  it('le date di BCE e Fed si inseriscono una volta sola e le legge chiunque', async () => {
    const dates = readFileSync('supabase/data/econ_events_2026_2027.sql', 'utf8')
    await db.exec(dates); await db.exec(dates)
    expect((await db.query<{ n: number }>('select count(*)::int n from public.econ_events')).rows[0].n).toBe(20)
    expect(await count('anon', null, 'public.econ_events')).toBe(20)
  })

  it('promemoria: il telefono li sostituisce, li vede solo chi li ha, senza account niente (0029)', async () => {
    const rows = (titles: string[], inMin: number) => ({ at: new Date(Date.now() + inMin * 60e3).toISOString(), day: '2026-11-01', titles })
    const call = (uid: string | null, list: unknown[]) => as(uid ? 'authenticated' : 'anon', uid, `select public.replace_reminders('${JSON.stringify(list)}'::jsonb)`)
    expect(await call(A, [rows(['Affitto'], 60), rows(['Luce', 'Gas'], 120), rows(['Troppo lontano'], 90 * 24 * 60)])).toBe(1)
    expect(await count('authenticated', A, 'public.push_reminders')).toBe(2)          // quello oltre i 60 giorni non entra
    expect(await call(A, [rows(['Solo questo'], 30)])).toBe(1)
    expect(await count('authenticated', A, 'public.push_reminders')).toBe(1)          // sostituiti, non aggiunti
    expect(await count('authenticated', B, 'public.push_reminders')).toBe(0)          // quelli di Anna non li vede Bruno
    expect(await call(null, [rows(['x'], 30)])).toMatch(/permission denied|not signed in/)
  })
})
