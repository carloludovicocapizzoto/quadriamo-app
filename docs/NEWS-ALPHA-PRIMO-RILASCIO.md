# Notizie Alpha: primo rilascio con BCE, ISTAT ed Eurostat

Preparato il 02/11/2026 sul branch `claude/alpha-news-sources`, che parte da `88cde4b3` (#21). Il branch non tocca #20, #21 né il branch di rilascio.

Nessun deploy, nessuna migrazione, nessun flag attivato, nessuna modifica cloud. Le fonti restano **inattive** finché Carlo non approva le condizioni e Federico non autorizza il backend.

## 1. Fonti e condizioni

Si mostrano soltanto il titolo originale, il nome della fonte e il link all'articolo. Niente estratti né immagini: si usa sempre la copertina di riserva.

| Fonte (id) | Feed | Perimetro (`linkPrefixes`) | Condizioni ufficiali | Attribuzione | Stato della verifica |
|---|---|---|---|---|---|
| BCE (`ecb-press`) | https://www.ecb.europa.eu/rss/press.html | `/press/pr/`, `/press/govcdec/` | [Disclaimer & copyright](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html): uso libero se le informazioni sono riportate con accuratezza e la BCE è citata come fonte; le modifiche vanno dichiarate; dai siti commerciali il sito BCE si apre a finestra intera, senza frame. Per i documenti firmati dagli autori serve un'autorizzazione scritta | «Fonte: BCE» | Pagina letta il 02/11. Feed: RSS, 200, nessuna immagine |
| BCE statistiche (`ecb-stats`) | https://www.ecb.europa.eu/rss/statpress.html | `/press/stats/` | Come sopra | «Fonte: BCE» | Feed: RSS, 200, nessuna immagine |
| Istat (`istat`) | https://www.istat.it/feed/ | `/comunicato-stampa/` | [Note legali](https://www.istat.it/note-legali/): CC BY 4.0 salvo diversa indicazione, anche per fini commerciali; immagini, loghi e contenuti di terzi esclusi; il logo richiede un'autorizzazione | «Fonte: Istat – CC BY 4.0», con link alla licenza | Pagina letta il 02/11. Il feed mescola comunicati, eventi, newsletter e microdati: 5 voci su 10 sono comunicati |
| Eurostat (`eurostat`) | Atom dei comunicati stampa (`CAT_PREREL`, URL completo nel manifesto) | Da fissare | [Copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice): CC BY 4.0 per i contenuti editoriali UE (Decisione 2011/833/UE), anche commerciale; foto e loghi di terzi esclusi | «Fonte: Eurostat – CC BY 4.0» | Feed visto rispondere 200 il 02/11. Poco dopo ec.europa.eu ha chiuso le connessioni (reset): pagina non riletta di persona |

Il manifesto è in `supabase/alpha-news/sources.first-release.json`. Ha `approvedBy` vuoto, quindi `tools/news/prepare-alpha.mjs` lo rifiuta. Anche dopo l'approvazione genera solo righe `active=false`.

### Decisioni per Carlo, o per un legale

1. **Uso commerciale.** BCE, ISTAT ed Eurostat lo permettono. Per la BCE, nel caso di un piano a pagamento, va detto agli utenti che le informazioni sono gratuite sul sito della BCE: con titolo e link il caso non si presenta, ma va tenuto presente.
2. **Attribuzione CC BY.** Oggi l'interfaccia Alpha mostra il nome della fonte su ogni scheda e, nel dettaglio, il link «Diritti sul titolo» alla pagina delle condizioni. Bisogna decidere se basta, o se serve la formula completa con la licenza («Fonte: Istat – CC BY 4.0»). In quel caso servono una colonna `attribution` e una piccola modifica all'interfaccia.
3. **Lingua.** I titoli di BCE ed Eurostat sono in inglese. Non si traducono: una traduzione è una modifica da dichiarare.
4. **Perimetro BCE.** Restano fuori discorsi, interviste e pubblicazioni firmate. Va confermato che bastano comunicati stampa e decisioni del Consiglio direttivo.
5. **Eurostat.** Va attivata solo dopo una lettura del feed dall'ambiente Alpha, che fissi `linkPrefixes` e confermi che il server non viene bloccato.

## 2. Cosa c'è già (2I) e cosa aggiunge questo branch

Già presenti nella 2I:
- **Schema e RLS** (`001_schema.sql`): le tabelle `news_sources` e `news_items`. Gli utenti autenticati possono solo leggere, e solo le fonti attive; `anon` non ha alcun permesso.
  - Una fonte può diventare attiva solo con `rights_reference` e `approved_by`.
  - Le immagini sono spente di default.
- **Gateway** (`002_gateway.sql`): lettura firmata e con limiti di frequenza per gli utenti. `service_role` può operare solo sulle due tabelle news.
- **Function Pages:** legge le notizie solo con `ALPHA_NEWS_ENABLED=1`.
- **Ingestione** (`alpha-news-ingest`):
  - accesso e sicurezza: `CRON_SECRET`, solo HTTPS verso gli host approvati, nessun redirect;
  - limiti: feed fino a 1 MB, timeout di 9 s, 4 fonti e 25 voci per esecuzione;
  - salvataggio: niente estratti, doppioni rimossi con l'impronta del link canonico e upsert idempotente, conservazione di 14 giorni.
- **Build:** rifiuta `cloud:news` senza `ALPHA_NEWS_BACKEND_READY=1`.

Aggiunte in questo branch:
- `003_source_scope.sql`: aggiunge la colonna `link_prefixes`, con vincolo sul formato. Si può rieseguire senza effetti.
- Ingestione:
  - tiene solo i link dentro il perimetro della fonte;
  - normalizza i link con la doppia barra della BCE;
  - salva il **titolo originale**, senza la pulizia di `cleanTitle`;
  - scarta le voci più vecchie della conservazione. Senza questo, i comunicati tra 14 e 45 giorni sarebbero cancellati e reinseriti a ogni esecuzione.
- `prepare-alpha.mjs`: legge e valida `linkPrefixes` e li scrive nel seed.
- Test: `tests/alpha-news-first-release.test.ts` (perimetro, titolo originale, conservazione, manifesto inattivo).

### Cosa manca, in ordine

1. Approvazione di Carlo delle condizioni (sezione 1), e `approvedBy` compilato nel manifesto.
2. Autorizzazione di Federico per Supabase Alpha.
3. Il **preflight dello schema**: verificare se l'Alpha ha già tabelle `news_*`. `001` usa `alter table … add column` senza `if not exists`, quindi su tabelle già esistenti si ferma con un errore. È un errore sicuro, perché la transazione viene annullata, ma blocca l'attivazione.
4. Applicare `001`, `002` e `003`; poi il seed inattivo.
5. Secret della Function: `CRON_SECRET` (nuovo, casuale), `NEWS_ALLOWED_HOSTS`, `ALPHA_NEWS_INGEST_ENABLED`. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` li fornisce la piattaforma. Il deploy va fatto con verifica JWT spenta, perché la Function controlla da sé `x-cron-secret`.
6. Vault (`alpha_news_ingest_url`, `alpha_news_cron_secret`), pg_cron e pg_net per il job ogni 2 ore, partendo da `cron.sql.example`.
7. Due punti dell'ingestione da migliorare, che non bloccano:
   - gli errori nell'aggiornare lo stato delle fonti (`statusError`) vengono ignorati;
   - il confronto di `x-cron-secret` non è a tempo costante.
8. Collaudo sul vero Alpha: RLS (`anon` negato, `authenticated` vede solo le fonti attive), gateway, deduplica, conservazione e perimetro. Poi Pages con `ALPHA_NEWS_ENABLED=1` e la build con `cloud:news` e `ALPHA_NEWS_BACKEND_READY=1`.

## 3. Procedura di attivazione

Ogni passo si fa solo con l'autorizzazione esplicita di Federico, e ci si ferma al primo esito diverso da quello atteso.

1. **Preflight, sola lettura:** controllare `to_regclass('public.news_sources')` e `public.news_items` e le colonne presenti; `select count(*) from cron.job where jobname like 'alpha-news%'` deve dare 0.
2. **Schema:** `001`, `002`, `003`, ciascuno nella propria transazione.
3. **Verifica dei permessi:**
   - `anon`: nessun accesso alle due tabelle;
   - `authenticated`: 0 righe finché tutte le fonti sono inattive;
   - un insert con `active=true` senza `rights_reference` o `approved_by` deve fallire.
4. **Seed:** generare l'SQL dal manifesto approvato con `node tools/news/prepare-alpha.mjs <manifesto> <dir>`, rileggerlo e applicarlo. Le fonti restano `active=false`.
5. **Function:** impostare i secret, con `ALPHA_NEWS_INGEST_ENABLED=0`, e fare il deploy. Una POST senza segreto deve rispondere 503, cioè ingestione spenta.
6. **Ingestione controllata:**
   - attivare **una** fonte, ISTAT:
     ```sql
     update news_sources set active=true where id='istat'
     ```
   - impostare `ALPHA_NEWS_INGEST_ENABLED=1` e fare una sola POST manuale con il segreto;
   - controllare:
     - `saved` è al massimo 25 e `failed` è vuoto;
     - i link stanno tutti sotto `/comunicato-stampa/`;
     - i titoli sono identici al feed, `excerpt` e `thumb` sono null;
     - una seconda POST salva 0 voci nuove, cioè niente doppioni.
7. Ripetere il passo 6 per `ecb-press`, `ecb-stats` ed `eurostat`. Eurostat va attivata solo se la lettura dal server riesce e dopo aver fissato `linkPrefixes`.
8. **Cron:** creare il job dal template, con i secret in Vault, e verificare la prima esecuzione automatica.
9. **App:** Pages con `ALPHA_NEWS_ENABLED=1`, poi la build con `cloud:news` e `ALPHA_NEWS_BACKEND_READY=1`. Collaudo della scheda Notizie su telefono, iPad e computer.

## 4. Rollback, dal più leggero

1. **Nascondere una fonte:** `update news_sources set active=false where id=…`. La RLS nasconde subito le sue notizie.
2. **Fermare l'ingestione:**
   - impostare `ALPHA_NEWS_INGEST_ENABLED=0`: la Function risponde 503;
   - disattivare il job: `select cron.unschedule('alpha-news-every-two-hours')`.
3. **Fermare la lettura dall'app:** Pages con `ALPHA_NEWS_ENABLED=0`, così il gateway rifiuta le rotte news. Con il client si torna alla build senza `cloud:news`: la scheda Notizie resta, con i soli consigli.
4. **Svuotare i contenuti:** `delete from news_items where source_id=…`. Sono notizie pubbliche e nessun dato degli utenti dipende da queste tabelle.

Non si eliminano le tabelle o le colonne in un rollback ordinario: restano vuote e inattive. Nessuna di queste operazioni tocca i documenti di sincronizzazione, il CAS o l'Auth.
