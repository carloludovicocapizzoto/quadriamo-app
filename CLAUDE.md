# Quadriamo — guida per lavorare sul progetto

Quadriamo è un budget personale che divide le entrate in quattro parti (regola 55/20/15/10) e dice ogni mattina quanto
puoi spendere oggi. È una PWA (React 19 + TypeScript + Vite, vite-plugin-pwa) con sincronizzazione su Supabase,
in 4 lingue (it, en, fr, es). Sito, app e area admin vivono in questo repo e si pubblicano da soli su GitHub Pages
a ogni push su `main`.

## Come si lavora qui
- Si scrive e si risponde in **italiano**, in modo semplice: il proprietario del progetto non è uno sviluppatore.
- **Prima di implementare qualcosa di sostanziale si propone** (analisi, alternative, cosa si toglie), poi si fa.
  Vale la «Costituzione»: niente funzioni nuove a caso, qualità da App Store, niente "bubble UI", la tipografia prima
  delle decorazioni, il movimento spiega e non decora. Vetro solo sulle superfici protagoniste (riepilogo del mese,
  «Adesso», ricevuta) e su barra in basso e fogli.
- **Solo regole, mai intelligenza artificiale**: nessuna funzione "AI", mai la parola nell'interfaccia o nel marketing.
- Loghi dei servizi: solo i nostri monogrammi, mai i marchi ufficiali. Niente scansioni di documenti.
- Ogni modifica vale per tutto l'ecosistema: app, sito (`index.html`, `public/*.html`) e admin (`src/admin`),
  con un solo design system (`src/design`).
- Dopo ogni modifica verificata: commit (messaggio in italiano, cosa cambia per chi usa l'app), push su `main`,
  poi si aspetta la GitHub Action **Deploy** (lint, test, prova end-to-end, pubblicazione).
- Le pull request dei collaboratori non si uniscono senza l'ok esplicito del proprietario.

## Privacy e sicurezza
- Nell'app ci sono solo valori pubblici (URL, chiave pubblicabile di Supabase, chiave pubblica delle notifiche).
  Le chiavi segrete stanno nelle Edge Functions (Secrets) e nei file `.env.*.local`, mai nel codice o in chat.
- I dati finanziari di ogni utente sono un documento JSON leggibile solo dal suo account (`public.user_data`, RLS).
  L'admin vede solo totali anonimi di almeno 5 persone.
- Il server conosce i nomi e gli orari dei promemoria, **mai gli importi**: li aggiunge il telefono.
- Le modifiche al database di produzione (migrazioni) le esegue il proprietario nell'SQL Editor di Supabase:
  admin → Configurazione dà gli script con i pulsanti per copiarli. Mai creare account o impostare password per altri.

## Comandi
```bash
npm install
npm run dev        # sito http://localhost:5173/ · app /app/ · admin /admin/ (usa il Supabase di produzione)
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite --port 5180   # app solo locale, sicura per le prove
npm test           # vitest: motore, store, lingue, regole del database (PGlite)
npm run lint       # oxlint (in CI con --deny-warnings)
npm run e2e        # build senza server + Chrome headless: 32 passi da utente (tests/e2e.mjs)
npm run build      # tsc + build di produzione in dist/
```
Configurazioni per l'anteprima: `.claude/launch.json` (`quadriamo-app` porta 5173, `quadriamo-local` porta 5180).

## Mappa del codice
- `src/engine/` — calcoli puri e testati: mese e riporti (`month.ts`, con `monthCache`: i risultati non vanno mutati),
  calendario ed eventi ricorrenti (`calendar.ts`), «Adesso» (`now.ts`), ricevuta, treemap del costo annuale,
  promemoria, previsioni (`reports.ts`), quanto puoi spendere (`spend.ts`), investimenti, import CSV, persona, obiettivi.
- `src/store/` — reducer, unione dei dati tra dispositivi (`merge.ts`), migrazioni del formato (`migrate.ts`, schema 5),
  salvataggio IndexedDB (`persist.ts`), validazione, backup JSON/CSV.
- `src/sync/` — sessione Supabase e sincronizzazione (`SyncProvider.tsx`: scarica, unisce, carica).
- `src/ui/` — schermate (home, calendario, abbonamenti, documenti, ricevuta, impostazioni, kit di componenti).
- `src/app/` — avvio, shell, router a hash (`#/profile/recurring`), effetti, diagnostica, scorciatoie.
- `src/admin/` — area admin (anche app desktop privata in `desktop-admin/`).
- `src/i18n/` — dizionari con le stesse chiavi (controllate da TypeScript e dai test).
- `supabase/migrations/` — 0001…0029, una per modifica, rieseguibili; `supabase/functions/` — send-push, news-ingest,
  news, billing, report-email.
- `marketing/` — campagna: `BRIEF.md` è la fonte di verità (cosa non dire: §12), script per immagini e video
  (`make_reels.py` + `voice.py`, voce sintetica Kokoro, versioni italiana e inglese con sottotitoli).
- `docs/` — PLAN, DESIGN, RELEASE (ambienti, versioni, APK Android), PRE-PRODUZIONE (checklist), NEWS-HUB, BETA_SETUP.
- `CHANGELOG.md` — una voce per versione, in italiano; la versione si cambia in `package.json`.

## Cose da sapere
- I dati di un utente sono un unico documento `AppData` (impostazioni, eventi del calendario dentro le impostazioni,
  movimenti, obiettivi, investimenti…). Oggi l'unione tra dispositivi tratta i movimenti uno per uno ma le impostazioni
  in blocco: attenzione a ogni scrittura automatica delle impostazioni.
- Date come stringhe `YYYY-MM-DD`, senza fusi orari; «oggi» è un parametro del motore (test deterministici).
- Prova sempre anche i telefoni 20:9 (circa 412×919 CSS), oltre a iPhone, iPad e Mac.
