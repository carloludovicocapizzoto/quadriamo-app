# Ambienti e rilascio

## I tre ambienti

> Dal 16 ottobre 2026 si usa **un solo backend** (la produzione, con il flag `tester` acceso) finché chi usa l'app sono i tester.
> La beta separata qui sotto è pronta: si riattiva con un progetto Supabase dedicato e le variabili `BETA_*`.

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
- `tester` — strumenti per chi prova l'app (segnalazioni con allegati e diagnostica). Oggi acceso in tutti gli ambienti.

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

## Android (APK per i tester)

L'APK è una Trusted Web Activity (il modo ufficiale di Google per pubblicare una PWA come app): dentro gira
l'app del sito, quindi notifiche, dati e aggiornamenti sono quelli della PWA. **Va ricostruito solo se cambiano
nome, icona o indirizzo**: ogni altra novità arriva da sola.

- Costruzione: GitHub → Actions → **Android** → Run workflow → `beta` o `production` (`tools/android/build.mjs`).
- Download per i tester (indirizzo fisso):
  - beta: `https://github.com/carloludovicocapizzoto/quadriamo-app/releases/download/android-beta/Quadriamo-Beta.apk`
  - produzione: `https://github.com/carloludovicocapizzoto/quadriamo-app/releases/download/android/Quadriamo.apk`
- Installazione: aprire il link sul telefono, consentire "installa app sconosciute" per il browser, aprire il file.
- Identificativi: `com.quadriamo.app.beta` e `com.quadriamo.app` (non si cambiano più: sono quelli del Play Store).
- Numero di versione Android: il numero dell'esecuzione dell'Action (sale sempre).

### Chiave di firma

Una sola, per sempre: se cambia, chi ha già l'app non può aggiornarla. È in `.keys.local/` (fuori da git):
`quadriamo-android.p12` e la password in `android-keystore.txt`. Tenerne una copia al sicuro (es. nel portachiavi
o in un password manager). Nella GitHub Action arriva dai segreti `ANDROID_KEYSTORE_B64` (il contenuto di
`quadriamo-android.p12.b64`) e `ANDROID_KEYSTORE_PASSWORD`.

### App a tutto schermo (senza barra dell'indirizzo)

Android mostra l'app senza barra dell'indirizzo solo se il sito dichiara che l'app è sua, con il file
`https://carloludovicocapizzoto.github.io/.well-known/assetlinks.json`. Quel file deve stare nella radice del
dominio, quindi in un repository a parte chiamato `carloludovicocapizzoto.github.io` (con GitHub Pages attivo).
Ogni build pubblica nella Release anche `assetlinks.json` già pronto da copiare lì. Con il dominio quadriamo.com
il file andrà su quel dominio.

## iPhone

Senza l'Apple Developer Program l'app per iPhone è la PWA: Safari → Condividi → Aggiungi alla schermata Home
(per la beta, dall'indirizzo `/quadriamo-app/beta/app/`). Notifiche e aggiornamenti funzionano dall'icona.
Il passaggio a TestFlight e App Store richiederà il programma Apple (99 $ l'anno) e un guscio nativo.
