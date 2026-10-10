import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// In produzione su GitHub Pages l'app vive in /quadriamo-app/ (BASE_PATH dalla GitHub Action); in sviluppo in /.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'fonts/*.ttf'],
      manifest: {
        name: 'Quadriamo',
        short_name: 'Quadriamo',
        description: 'Your money, in four: the 55-20-15-10 budget planner.',
        lang: 'en',
        start_url: `${base}app/`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF7F2',
        theme_color: '#1F2328',
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
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ttf}'], navigateFallback: null },
    }),
  ],
  build: { rollupOptions: { input: { home: 'index.html', app: 'app/index.html' } } },
  test: { include: ['src/**/*.test.ts'] },
})
