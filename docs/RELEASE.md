# Ambienti e rilascio

## Ambienti

Due ambienti, un solo backend (il progetto Supabase di produzione), scelto il 16 ottobre 2026: chi usa l'app oggi sono i tester.

| | Sviluppo | Produzione |
|---|---|---|
| Comando | `npm run dev` | `npm run build` |
| Indirizzo | localhost:5173 | …/quadriamo-app/ |
| Supabase | `.env.development.local` | `.env.production.local`, variabili del repository |
| Flag | `.env.development` | `.env.production` |

Tutta la configurazione dell'app passa da `src/env.ts`: nessun altro file legge `import.meta.env`.
Nell'app ci sono solo valori pubblici (URL, chiave pubblicabile, chiave pubblica delle notifiche);
le chiavi segrete restano nelle funzioni di Supabase (Edge Functions → Secrets).
Un ambiente di prova separato (staging) si aggiunge prima del lancio pubblico: un progetto Supabase dedicato,
un file `.env.<nome>` e un passo nella GitHub Action.

### Variabili nella GitHub Action (Settings → Secrets and variables → Actions → Variables)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`

### Feature flag

`VITE_FLAGS` nei file `.env.<ambiente>`, separati da virgola. Oggi:
- `tester` — strumenti per chi prova l'app (segnalazioni con allegati e diagnostica, avviso a ogni nuova build). Acceso in sviluppo e produzione.

## Versioni

- **Versione** (`package.json`, es. 0.9.0): si cambia a mano quando esce un gruppo di novità.
  Patch per correzioni, minor per novità, 1.0.0 all'uscita sugli store.
- **Build**: il numero di commit, calcolato a ogni costruzione. Sale sempre, non si tocca.
- **Commit**: il codice esatto, per ricostruire un errore.

L'app mostra `0.9.0 (146)` nel Profilo; statistiche, errori e feedback salvano `0.9.0+146`.

## Pubblicare una nuova versione

Per il protocollo di sincronizzazione revisionata, seguire prima [SYNC_RELEASE.md](SYNC_RELEASE.md): il merge avvia il deploy del frontend, ma non installa le RPC nel database. Sono necessari migrazione approvata, backup verificato e rilascio coordinato.

1. Aggiorna `version` in `package.json` e aggiungi la voce in `CHANGELOG.md`.
2. Commit e push su `main`: la GitHub Action controlla, testa e pubblica.
3. Le app installate si aggiornano da sole alla prossima apertura (service worker in `autoUpdate`).

## Android (APK per i tester)

L'APK è una Trusted Web Activity (il modo ufficiale di Google per pubblicare una PWA come app): dentro gira
l'app del sito, quindi notifiche, dati e aggiornamenti sono quelli della PWA. **Va ricostruito solo se cambiano
nome, icona o indirizzo**: ogni altra novità arriva da sola.

- Costruzione: GitHub → Actions → **Android** → Run workflow (`tools/android/build.mjs`).
- Download per i tester (indirizzo fisso): `https://github.com/carloludovicocapizzoto/quadriamo-app/releases/download/android/Quadriamo.apk`
- Installazione: aprire il link sul telefono, consentire "installa app sconosciute" per il browser, aprire il file.
- Identificativo: `com.quadriamo.app` (non si cambia più: è quello del Play Store).
- Numero di versione Android: il numero dell'esecuzione dell'Action (sale sempre).

### Chiave di firma

Una sola, per sempre: se cambia, chi ha già l'app non può aggiornarla. È in `.keys.local/` (fuori da git):
`quadriamo-android.p12` e la password in `android-keystore.txt`. Tenerne una copia al sicuro (es. nel portachiavi
o in un password manager). Nella GitHub Action arriva dai segreti `ANDROID_KEYSTORE_B64` (il contenuto di
`quadriamo-android.p12.b64`) e `ANDROID_KEYSTORE_PASSWORD`.

### App a tutto schermo (senza barra dell'indirizzo)

Android apre l'app a tutto schermo solo se la radice del dominio dichiara che l'app è sua:
`https://carloludovicocapizzoto.github.io/.well-known/assetlinks.json` (nome `com.quadriamo.app` + impronta della firma).
**Oggi (16/10/2026) il file sta, provvisoriamente, nel repository del CV** `carloludovicocapizzoto.github.io`
(solo quel file, invisibile nelle pagine). Verifica: API `digitalassetlinks.googleapis.com/v1/assetlinks:check` → `linked: true`.
Ogni build dell'APK pubblica nella Release anche `assetlinks.json` aggiornato.

### Quando ci sarà il dominio di Quadriamo

1. Collegare il dominio all'app e impostare `BASE_PATH`; aggiornare gli indirizzi scritti nel codice:
   `tools/android/build.mjs` (SITE), `src/admin/panels/Setup.tsx` (SITE), funzioni `report-email` (ADMIN_URL) e `send-push` (APP_URL),
   link in `public/inizia.html` e `public/install.html`, email in `public/owner.js`, contatto in `public/help.json`;
   in Supabase: Authentication → URL Configuration (Site URL e Redirect URLs).
2. Pubblicare `assetlinks.json` nella radice del nuovo dominio (es. `public/.well-known/assetlinks.json`) e ricontrollare con l'API.
3. Actions → Android → Run: stesso nome e stessa chiave, quindi è un aggiornamento. I tester reinstallano una volta;
   il nuovo indirizzo ha una memoria del browser nuova, quindi si rientra nell'account e i dati tornano dalla sincronizzazione.
4. Togliere `.well-known/` dal repository del CV.

## iPhone

Senza l'Apple Developer Program l'app per iPhone è la PWA: Safari → Condividi → Aggiungi alla schermata Home
Notifiche e aggiornamenti funzionano dall'icona.
Il passaggio a TestFlight e App Store richiederà il programma Apple (99 $ l'anno) e un guscio nativo.
