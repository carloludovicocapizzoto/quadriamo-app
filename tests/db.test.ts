// Il database su Postgres vero (PGlite), con le parti di Supabase ridotte all'essenziale (tests/db/supabase.sql):
// tutte le migrazioni si applicano in ordine, e le regole di accesso fanno quello che promettono.
// Chi prova: anon (senza account), authenticated (con test.uid = l'utente), l'amministratore (test.admin = on).
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'

const DIR = 'supabase/migrations'
const A = '30000000-0000-4000-8000-00000000000a', B = '30000000-0000-4000-8000-00000000000b', C = '30000000-0000-4000-8000-00000000000c'
const HOME = '40000000-0000-4000-8000-000000000001', OTHER = '40000000-0000-4000-8000-000000000002'
let db: PGlite

/** Esegue come un ruolo (e un utente); dice quante righe ha toccato o il motivo del rifiuto. */
async function as(role: 'anon' | 'authenticated', uid: string | null, sql: string): Promise<number | string> {
  await db.exec(`set role ${role}; set test.uid = '${uid ?? ''}'`)
  try { const r = await db.query(sql); return r.affectedRows || r.rows.length }
  catch (e) { return (e as Error).message }
  finally { await db.exec(`reset role; set test.uid = ''`) }
}
const count = async (role: 'anon' | 'authenticated', uid: string | null, table: string) => as(role, uid, `select 1 from ${table}`)

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(readFileSync('tests/db/supabase.sql', 'utf8'))
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()) {
    // Il protocollo deve revocare anche grant ereditati dai default ACL del progetto ospitante.
    if (f.startsWith('0030_')) await db.exec('alter default privileges for role postgres in schema public grant execute on functions to service_role')
    try { await db.exec(readFileSync(`${DIR}/${f}`, 'utf8')) } catch (e) { throw new Error(`${f}: ${(e as Error).message}`) }
  }
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
    await db.exec(`insert into auth.users(id,email) values ('${user}','pilot@synthetic.invalid')`)
    expect(await as('authenticated', user, 'select public.qsync_activate()')).toMatch(/QSYNC_ACTIVATION_NOT_ENABLED/)
    await db.exec(`set test.uid='${user}'`)
    const read = await db.query<{ value: { activationAllowed: boolean; mode: string } }>('select public.qsync_read() as value')
    expect(read.rows[0].value).toMatchObject({ activationAllowed: false, mode: 'legacy' })
    await db.exec(`set test.uid=''; insert into qsync_private.heads(user_id,activation_allowed) values ('${user}',true)`)
    expect(await as('authenticated', user, 'select public.qsync_activate()')).toBe(1)
    expect((await db.query<{ protected: boolean }>(`select protected from qsync_private.heads where user_id='${user}'`)).rows[0].protected).toBe(true)
  })

  it('0030: creazione CAS, risposta persa e vecchio writer non duplicano o sostituiscono il documento', async () => {
    const user = '30000000-0000-4000-8000-00000000000e'
    const document = { version: 1, settings: { schema: 5, buckets: [], categories: [], events: [] }, transactions: [] }
    const operation = '50000000-0000-4000-8000-000000000001'
    await db.exec(`insert into auth.users(id,email) values ('${user}','cas@synthetic.invalid');
      insert into qsync_private.heads(user_id,activation_allowed) values ('${user}',true)`)
    expect(await as('authenticated', user, 'select public.qsync_activate()')).toBe(1)
    const write = `select public.qsync_write('0','${operation}','${JSON.stringify(document)}'::jsonb)`
    expect(await as('authenticated', user, write)).toBe(1)
    expect(await as('authenticated', user, write)).toBe(1)
    expect((await db.query<{ n: number }>(`select count(*)::int n from qsync_private.history where user_id='${user}'`)).rows[0].n).toBe(1)
    expect(await as('authenticated', user, `update public.user_data set data='{}' where user_id='${user}'`)).toMatch(/QSYNC_UPGRADE_REQUIRED/)
    expect(await as('authenticated', user, write.replace('"transactions":[]', '"transactions":[{}]'))).toMatch(/QSYNC_OPERATION_REUSED/)
    expect(await count('authenticated', A, 'qsync_private.receipts')).toMatch(/permission denied/)
    expect((await db.query<{ data: unknown }>(`select data from public.user_data where user_id='${user}'`)).rows[0].data).toEqual(document)
  })

  it('0030: anon non può chiamare RPC e i metadati privati hanno RLS senza privilegi client', async () => {
    expect(await as('anon', null, 'select public.qsync_read()')).toMatch(/permission denied/)
    const r = await db.query<{ n: number }>(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='qsync_private' and c.relkind='r' and c.relrowsecurity`)
    expect(r.rows[0].n).toBe(3)
    expect(await count('authenticated', B, 'qsync_private.heads')).toMatch(/permission denied/)
    expect((await db.query<{ allowed: boolean }>(`select has_function_privilege('service_role','public.qsync_write(text,uuid,jsonb)','execute') as allowed`)).rows[0].allowed).toBe(false)
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
