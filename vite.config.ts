import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'fonts/DMSerifDisplay-Regular.ttf', 'fonts/*.woff2'],
      manifest: {
        id: `${base}app/`,
        // la beta installata accanto all'app normale si riconosce dal nome
        name: mode === 'beta' ? 'Quadriamo Beta' : 'Quadriamo',
        short_name: mode === 'beta' ? 'Q. Beta' : 'Quadriamo',
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
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2,json}'], globIgnores: ['fonts/DMSans.ttf'], navigateFallback: null, importScripts: ['push-sw.js'] },
    }),
  ],
  build: {
    rollupOptions: {
      input: { home: 'index.html', app: 'app/index.html', admin: 'admin/index.html', news: 'notizie/index.html' },
      // le librerie in pezzi a parte: cambiano di rado, restano in memoria sul telefono e a ogni aggiornamento si scarica solo l'app
      output: { manualChunks: (id: string) => id.includes('node_modules/@supabase/') ? 'supabase' : /node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined },
    },
  },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'] },
}))
