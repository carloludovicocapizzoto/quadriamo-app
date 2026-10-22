import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { mergeConfig } from 'vite'
import base from '../../vite.config.ts'

const repo = fileURLToPath(new URL('../../', import.meta.url))
export default mergeConfig(base({ mode: 'development', command: 'serve' }), {
  root: resolve(repo, 'tests/browser/fixture'), publicDir: resolve(repo, 'public'), envDir: repo,
  cacheDir: resolve(repo, 'node_modules/.vite-account-tests'),
  optimizeDeps: { entries: ['index.html'], include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'idb-keyval', '@supabase/supabase-js'] },
  resolve: { alias: { '@app': resolve(repo, 'src') }, dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 5197, strictPort: true, fs: { allow: [repo] } },
})
