// L'ambiente in cui gira l'app e tutta la sua configurazione, in un punto solo: il resto del codice legge da qui.
// Due ambienti: development (npm run dev) e production (npm run build).
// I valori arrivano dai file .env.<ambiente> e dalle variabili della GitHub Action: cambiare ambiente o chiavi
// non richiede modifiche al codice. Qui solo valori pubblici: i segreti stanno nelle funzioni di Supabase, mai nell'app.
export type EnvName = 'development' | 'production'

const e = import.meta.env
const name: EnvName = e.MODE === 'production' ? 'production' : 'development'
const flags = new Set(String(e.VITE_FLAGS ?? '').split(',').map(f => f.trim()))
const url = e.VITE_SUPABASE_URL as string | undefined
const key = (e.VITE_SUPABASE_PUBLISHABLE_KEY ?? e.VITE_SUPABASE_ANON_KEY) as string | undefined

export const ENV = {
  name,
  /** Dove vive il sito: / in sviluppo, /quadriamo-app/ in produzione. */
  base: e.BASE_URL,
  version: __APP_VERSION__,
  build: __APP_BUILD__,
  commit: __APP_COMMIT__,
  /** Versione completa, salvata con statistiche, errori e feedback: 0.9.0+412. */
  release: `${__APP_VERSION__}+${__APP_BUILD__}`,
  /** Versione da mostrare: 0.9.0 (412), con l'ambiente se non è la produzione. */
  label: `${__APP_VERSION__} (${__APP_BUILD__})${name === 'production' ? '' : ` · ${name}`}`,
  /** Senza URL e chiave l'app funziona solo sul dispositivo (anche nei test che usano l'app). */
  supabase: url && key ? { url, key, ref: url.match(/https:\/\/([^.]+)\./)?.[1] ?? '' } : null,
  vapidKey: (e.VITE_VAPID_PUBLIC_KEY as string | undefined) || null,
  flags: {
    /** Strumenti per chi prova l'app: segnalazioni con allegati e diagnostica, avviso a ogni nuova build. */
    tester: flags.has('tester'),
  },
}
