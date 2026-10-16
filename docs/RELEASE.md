# Ambienti e rilascio

## I tre ambienti

| | Sviluppo | Beta | Produzione |
|---|---|---|---|
| Comando | `npm run dev` | `npm run build:beta` | `npm run build` |
| Indirizzo | localhost:5173 | …/quadriamo-app/beta/ | …/quadriamo-app/ |
| Supabase | `.env.development.local` | progetto beta (`.env.beta.local`, variabili `BETA_*`) | progetto di produzione |
| Flag | `.env.development` | `.env.beta` | `.env.production` |

Tutta la configurazione dell'app passa da `src/env.ts`: nessun altro file legge `import.meta.env`.
Nell'app ci sono solo valori pubblici (URL, chiave pubblicabile, chiave pubblica delle notifiche);
le chiavi segrete restano nelle funzioni di Supabase (Edge Functions → Secrets).

Beta e produzione condividono l'indirizzo, quindi anche la memoria del browser: le chiavi della beta
hanno il prefisso `beta:` (`storageKey` in `src/env.ts`, e `public/push-sw.js` per la notifica del mattino).

### Variabili nella GitHub Action (Settings → Secrets and variables → Actions → Variables)

- Produzione: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`
- Beta: `BETA_VITE_SUPABASE_URL`, `BETA_VITE_SUPABASE_PUBLISHABLE_KEY`, `BETA_VITE_VAPID_PUBLIC_KEY`
  (finché `BETA_VITE_SUPABASE_URL` è vuota la beta non viene costruita)

### Feature flag

`VITE_FLAGS` nei file `.env.<ambiente>`, separati da virgola. Oggi:
- `tester` — strumenti per chi prova la beta (segnalazioni con allegati e diagnostica).

## Versioni

- **Versione** (`package.json`, es. 0.9.0): si cambia a mano quando esce un gruppo di novità.
  Patch per correzioni, minor per novità, 1.0.0 all'uscita sugli store.
- **Build**: il numero di commit, calcolato a ogni costruzione. Sale sempre, non si tocca.
- **Commit**: il codice esatto, per ricostruire un errore.

L'app mostra `0.9.0 (146)` nel Profilo; statistiche, errori e feedback salvano `0.9.0+146`.

## Pubblicare una nuova versione

1. Aggiorna `version` in `package.json` e aggiungi la voce in `CHANGELOG.md`.
2. Commit e push su `main`: la GitHub Action controlla, testa e pubblica produzione e beta.
3. Le app installate si aggiornano da sole alla prossima apertura (service worker in `autoUpdate`).
