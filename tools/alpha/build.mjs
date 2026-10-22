import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const source = process.env.ALPHA_SUPABASE_URL
const key = process.env.ALPHA_SUPABASE_PUBLISHABLE_KEY
const expected = process.env.ALPHA_EXPECTED_PROJECT_REF
const origin = process.env.ALPHA_FRONTEND_ORIGIN
const local = process.env.ALPHA_LOCAL_BUILD === '1'
if (!source || !key || !expected || !origin) throw Error('Alpha URL, public key, project ref and frontend origin are required')
const url = new URL(source)
const site = new URL(origin)
if (url.pathname !== '/' || url.search || url.hash || site.pathname !== '/' || site.search || site.hash) throw Error('Alpha endpoints must be origins without paths or queries')
if (local) {
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['127.0.0.1', 'localhost'].includes(site.hostname)
      || expected !== 'local-lab') throw Error('Local Alpha build must use only localhost and local-lab')
} else if (url.protocol !== 'https:' || url.hostname !== `${expected}.supabase.co` || site.protocol !== 'https:'
    || site.hostname === url.hostname || site.hostname.endsWith('.github.io')) {
  throw Error('Alpha cloud build requires a reviewed new Supabase ref and separate HTTPS origin')
}
if (key.startsWith('sb_secret_')) throw Error('A private Supabase key cannot enter a frontend bundle')
if (!key.startsWith('sb_publishable_')) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
    if (claims.role !== 'anon') throw Error('not an anon key')
  } catch { throw Error('Alpha frontend key must be publishable or an anon JWT') }
}

const env = { ...process.env, BASE_PATH: '/', VITE_SUPABASE_URL: url.origin,
  VITE_SUPABASE_PUBLISHABLE_KEY: key, VITE_SUPABASE_ANON_KEY: '', VITE_FLAGS: '', VITE_VAPID_PUBLIC_KEY: '' }
for (const args of [
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build', '--mode', 'alpha', '--outDir', 'dist-alpha'],
]) {
  const run = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (run.error) throw run.error
  if (run.status !== 0) process.exit(run.status ?? 1)
}
process.stdout.write('Alpha build ready for review; no publication performed.\n')
