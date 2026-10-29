import { ISOLATION_WORKER, ISOLATION_PUSH_SCRIPT } from './src/pushProtocol.ts'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { defineConfig, type Plugin } from 'vitest/config'

// Il design system (src/design) è uno solo: l'app e l'admin lo importano, le pagine statiche del sito
// (public/*.html, index.html) leggono public/ds/quadriamo.css, generato qui da quegli stessi file a ogni avvio e costruzione.
function designSystemForSite(): Plugin {
  const write = () => {
    const css = ['tokens', 'backgrounds', 'motion'].map(f => readFileSync(`src/design/${f}.css`, 'utf8')).join('\n')
      .replaceAll('url("/fonts/', 'url("../fonts/')
    mkdirSync('public/ds', { recursive: true })
    writeFileSync('public/ds/quadriamo.css', `/* Generato da src/design (vite.config.ts): non modificare qui. */\n${css}`)
  }
  return { name: 'quadriamo-design-system', buildStart: write, configureServer: write, handleHotUpdate: ({ file }) => { if (file.includes('/src/design/')) write() } }
}

// Content Security Policy per le pagine con codice (app, admin, notizie): script solo dal sito, dati solo dal sito,
// da Supabase dell'ambiente, dai cambi BCE e dai prezzi crypto di CoinGecko; immagini e audio delle notizie da qualsiasi indirizzo https.
// Se un testo esterno (una notizia, un feed) contenesse codice, il browser non lo eseguirebbe. Solo nella build:
// in sviluppo Vite ha bisogno di script in linea. GitHub Pages non manda intestazioni: la regola va nella pagina.
function contentSecurityPolicy(mode: string): Plugin {
  const supabase = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL
  const api = supabase ? `${supabase} ${supabase.replace(/^https/, 'wss')}` : ''
  const csp = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "font-src 'self'",
    "img-src 'self' data: blob: https:", "media-src 'self' blob: https:",
    `connect-src 'self' ${api} https://api.frankfurter.dev https://api.coingecko.com`.replace(/\s+/g, ' '),
    "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ')
  return {
    name: 'quadriamo-csp', apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html, ctx) => /(^|\/)(app|admin|notizie)\/index\.html$/.test(ctx.path)
      ? html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`) : html },
  }
}

// Identità della build: versione da package.json, numero = quanti commit ci sono (sale sempre), commit corto.
const git = (cmd: string, fallback: string) => { try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return fallback } }
const BUILD = { version: JSON.parse(readFileSync('package.json', 'utf8')).version as string, number: git('rev-list --count HEAD', '0'), commit: git('rev-parse --short HEAD', 'dev') }

// In produzione su GitHub Pages l'app vive in /quadriamo-app/ (BASE_PATH dalla GitHub Action); in sviluppo in /.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig(({ mode }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(BUILD.version), __APP_BUILD__: JSON.stringify(BUILD.number), __APP_COMMIT__: JSON.stringify(BUILD.commit) },
  plugins: [
    designSystemForSite(),
    contentSecurityPolicy(mode),
    react(),
    VitePWA({
      registerType: 'autoUpdate', filename: ISOLATION_WORKER,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'fonts/DMSerifDisplay-Regular.ttf', 'fonts/*.woff2'],
      manifest: {
        id: `${base}app/`,
        name: 'Quadriamo',
        short_name: 'Quadriamo',
        categories: ['finance', 'productivity'],
        description: 'Your money, in four: the 55-20-15-10 budget planner.',
        lang: 'en',
        start_url: `${base}app/`,
        scope: base,
        display: 'standalone',
        // Android colora la zona della barra di navigazione (e la schermata di avvio) con background_color:
        // il blu notte della Home scura, così non resta una fascia chiara sotto l'app; theme_color è la barra di stato
        background_color: '#0B141D',
        theme_color: '#1C3F52',
        shortcuts: [
          { name: 'Aggiungi spesa · Add expense', short_name: '+', url: `${base}app/?add=1`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2,json}'], globIgnores: ['fonts/DMSans.ttf'], importScripts: [ISOLATION_PUSH_SCRIPT],
        // aprire l'app = la pagina salvata con la stessa versione del codice: un aggiornamento arriva tutto insieme
        // (non la pagina vecchia dalla cache del browser per 10 minuti) e l'app si apre sempre, anche senza rete.
        // Solo gli indirizzi dell'app: il resto del sito resta com'è.
        navigateFallback: `${base}app/index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}app/(index\\.html)?(\\?.*)?$`)],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: (mode === 'alpha'
        ? { home: 'index.html', app: 'app/index.html', news: 'notizie/index.html' }
        : { home: 'index.html', app: 'app/index.html', admin: 'admin/index.html', news: 'notizie/index.html' }) as Record<string, string>,
      // le librerie in pezzi a parte: cambiano di rado, restano in memoria sul telefono e a ogni aggiornamento si scarica solo l'app
      output: { manualChunks: (id: string) => id.includes('node_modules/@supabase/') ? 'supabase' : /node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined },
    },
  },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'] },
}))
