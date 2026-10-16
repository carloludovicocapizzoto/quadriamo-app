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
})
