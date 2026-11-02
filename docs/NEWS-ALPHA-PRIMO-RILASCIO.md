# Notizie Alpha: primo rilascio con BCE, ISTAT ed Eurostat

Preparato il 02/11/2026 sul branch `claude/alpha-news-sources`, che parte da `88cde4b3` (#21). Il branch non tocca #20, #21 né il branch di rilascio.

Nessun deploy, nessuna migrazione, nessun flag attivato, nessuna modifica cloud.

**Condizioni d'uso approvate il 02/11/2026** da Federico e Carlo per BCE e ISTAT, nel perimetro indicato sotto. È un'approvazione delle condizioni, non un'autorizzazione a modificare il cloud. Il feed, il percorso dei link e la licenza editoriale Eurostat sono stati verificati localmente il 02/11; Eurostat resta nel manifesto ma sospesa (`hold`) finché non è provata l'uscita HTTPS dal backend Alpha e non viene autorizzata l'attivazione. Il seed genera sempre fonti `active=false`.

## 1. Fonti e condizioni

Si mostrano soltanto il titolo originale, il nome della fonte e il link all'articolo. Niente estratti né immagini: si usa sempre la copertina di riserva.

| Fonte (id) | Feed | Perimetro (`linkPrefixes`) | Condizioni ufficiali | Attribuzione | Stato della verifica |
|---|---|---|---|---|---|
| BCE (`ecb-press`) | https://www.ecb.europa.eu/rss/press.html | `/press/pr/`, `/press/govcdec/` | [Disclaimer & copyright](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html): uso libero se le informazioni sono riportate con accuratezza e la BCE è citata come fonte; le modifiche vanno dichiarate; dai siti commerciali il sito BCE si apre a finestra intera, senza frame. Per i documenti firmati dagli autori serve un'autorizzazione scritta | «Fonte: BCE · Condizioni d'uso» (link alle condizioni) | Pagina letta il 02/11. Feed: RSS, 200, nessuna immagine |
| BCE statistiche (`ecb-stats`) | https://www.ecb.europa.eu/rss/statpress.html | `/press/stats/` | Come sopra | «Fonte: BCE · Condizioni d'uso» | Feed: RSS, 200, nessuna immagine |
| Istat (`istat`) | https://www.istat.it/feed/ | `/comunicato-stampa/` | [Note legali](https://www.istat.it/note-legali/): CC BY 4.0 salvo diversa indicazione, anche per fini commerciali; immagini, loghi e contenuti di terzi esclusi; il logo richiede un'autorizzazione | «Fonte: Istat · CC BY 4.0», con link alla licenza, e il pulsante all'articolo originale | Pagina letta il 02/11. Il feed mescola comunicati, eventi, newsletter e microdati: 5 voci su 10 sono comunicati |
| Eurostat (`eurostat`) | Atom ufficiale dei comunicati stampa (`CAT_PREREL`, URL completo nel manifesto), 200 e 11 entry osservati da rete locale | `/eurostat/product` (link con codice stabile; un redirect d'esempio resta su `ec.europa.eu`) | [Copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice): CC BY 4.0 per contenuti editoriali UE anche commerciali; attribuzione e indicazione di modifiche. Foto, illustrazioni di terzi e loghi esclusi | «Fonte: Eurostat · CC BY 4.0», link alla licenza e all'articolo; solo titolo originale, nessun estratto/immagine | Feed e link verificati localmente il 02/11; **non** verificati dall'Edge Function Alpha. Host non ancora ammesso in `NEWS_ALLOWED_HOSTS`, quindi resta `hold` e inattiva |

Il manifesto è in `supabase/alpha-news/sources.first-release.json`. `approvedBy` è compilato. `tools/news/prepare-alpha.mjs` salta le fonti `hold`, richiede per ogni fonte l'attribuzione (e il nome con il link HTTPS della licenza, se c'è) e genera righe `active=false`.

### Decisioni prese il 02/11

1. **BCE.** Comunicati, decisioni del Consiglio direttivo e statistiche, con attribuzione esplicita e link diretto. Se le Notizie entrano in un piano a pagamento, va mostrato che le informazioni sono gratuite sul sito BCE: è un gate prima di qualunque offerta a pagamento delle Notizie.
2. **ISTAT.** La dicitura «Fonte: Istat · CC BY 4.0» compare nel dettaglio della notizia, con il link alla licenza e il pulsante all'articolo originale. Sulle schede dell'elenco resta il nome della fonte.
3. **Lingua.** I titoli originali in inglese di BCE ed Eurostat restano, senza traduzioni.
4. **Eurostat.** Perimetro `linkPrefixes` fissato a `/eurostat/product` dopo aver letto il feed ufficiale; il parser comune supporta Atom. Resta sospesa finché un test controllato dal backend Alpha non dimostra l'egress HTTPS consentito e il proprietario non autorizza l'attivazione. Le sole URL RSS/Atom non conferiscono diritti: il perimetro è limitato a titoli originali, attribuzione, link all'articolo e alla licenza; nessun estratto, immagine o logo.

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
- `003_source_scope.sql` aggiunge anche `attribution`, `licence_name` e `licence_url`, con vincoli: lunghezze, licenza solo HTTPS, nome e link sempre insieme, nessuna fonte attiva senza attribuzione.
- `prepare-alpha.mjs` legge e valida `linkPrefixes`, attribuzione e licenza, e salta le fonti `hold`.
- App Alpha: legge `attribution`, `licence_name` e `licence_url` e mostra la riga di credito nel dettaglio. Le fonti senza attribuzione mantengono il link «Diritti sul titolo» della 2I.
- Sicurezza dell'ingestione:
  - `x-cron-secret` è confrontato a tempo costante (SHA-256 di entrambi i valori);
  - un errore nell'aggiornare lo stato di una fonte non viene più ignorato: la risposta è 500 con `statusFailed`.
- Test: `tests/alpha-news-first-release.test.ts` (perimetro, titolo originale, conservazione, manifesto, riga di credito, segreto, errori di stato). L'e2e del Piano e delle Notizie controlla la riga di credito nel dettaglio.

### Stato del backend Alpha e gate residui (02/11/2026)

- `001_schema.sql`, `002_gateway.sql` e `003_source_scope.sql` risultano applicati; schema, policy e privilegi sono stati ispezionati in sola lettura.
- Sono presenti le tre fonti BCE comunicati, BCE statistiche e ISTAT, tutte `active=false`, `images=false`. L'ingestione manuale ha salvato 7, 4 e 5 titoli rispettivamente; la seconda esecuzione è stata idempotente. I 16 record non hanno estratti né immagini.
- La Edge Function `alpha-news-ingest` è distribuita e il percorso manuale protetto è stato verificato. `ALPHA_NEWS_INGEST_ENABLED=0`; il feed pubblico resta OFF. Il test anonimo alle tabelle è stato negato (`401`, `42501`). L'ispezione della policy non sostituisce ancora una lettura con JWT di un utente autenticato.
- Eurostat non è stata seminata: il feed Atom, il prefisso `/eurostat/product` e la licenza editoriale sono verificati localmente, ma non l'uscita dal runtime Supabase. L'allowlist corrente contiene solo `www.ecb.europa.eu,www.istat.it`.
- Non risultano job `alpha-news-*`; `pg_net` non è installato. Non è stato creato o attivato alcun cron.
- La Function Alpha ha la verifica JWT attiva. Il vecchio `cron.sql.example`, che ipotizzava JWT OFF e solo `x-cron-secret`, non è eseguibile in questa configurazione: il template sotto mantiene JWT ON e richiede un JWT non privilegiato in Vault oltre al segreto applicativo. Se non è disponibile un token compatibile, fermarsi; non disattivare la verifica JWT come scorciatoia.

I gate residui sono: un test RLS di lettura con JWT utente reale; per Eurostat, aggiunta autorizzata di `ec.europa.eu` all'allowlist e una prova manuale/di idempotenza dalla Function prima di qualunque attivazione; per lo scheduler, disponibilità/approvazione di `pg_cron`, `pg_net`, Vault e JWT invoker. Nessun gate richiede una nuova migrazione per aggiungere la sola riga Eurostat.

## 3. Procedura di attivazione

Ogni passo si fa solo con l'autorizzazione esplicita di Federico, e ci si ferma al primo esito diverso da quello atteso.

1. **Preflight, sola lettura:** confermare il progetto Alpha, le colonne attuali e che non esista `alpha-news-every-two-hours`; confrontare lo schema prima di qualunque migrazione.
2. **Verifica dei permessi:**
   - `anon`: nessun accesso alle due tabelle;
   - `authenticated`: 0 righe finché tutte le fonti sono inattive;
   - un insert con `active=true` senza `rights_reference` o `approved_by` deve fallire.
3. **Seed:** generare l'SQL dal manifesto approvato con `node tools/news/prepare-alpha.mjs <manifesto> <dir>`, rileggerlo e applicarlo. Le fonti restano `active=false`.
4. **Function:** la Function è già distribuita. Prima di qualsiasi nuova invocazione, verificare che `ALPHA_NEWS_INGEST_ENABLED=0`; non ruotare o cambiare segreti in questa procedura.
5. **Ingestione controllata BCE/ISTAT:** solo con autorizzazione, attivare una fonte alla volta e confrontare titolo/link, `excerpt=null`, `thumb=null`; ripetere per verificare idempotenza. I risultati già registrati non vanno ripetuti senza motivo.
6. **Eurostat:** resta fuori dal seed finché è `hold`. Per provarla serve autorizzare l'allowlist `ec.europa.eu`, verificare la Function dal server e controllare una seconda ingestione senza duplicati. Nessuna immagine o estratto.
7. **Scheduler scelto:** Supabase Cron (`pg_cron`) ogni due ore con `pg_net` e Vault, in un solo job `alpha-news-every-two-hours`. Mantenere JWT verification ON e inviare un JWT invoker non privilegiato da Vault più `x-cron-secret`. La Function usa la service role solo server-side. Nessun retry aggressivo: un errore di feed resta nel suo stato, l'idempotenza rende sicuro il giro successivo. Attivare solo dopo disponibilità e preflight delle estensioni/Vault; nessun job duplicato.
8. **App pubblica:** mantenere `ALPHA_NEWS_ENABLED=0` e non compilare `cloud:news` finché schema, JWT/RLS utente, fonti autorizzate, ingestione e scheduler non hanno superato i rispettivi gate.

## 4. Rollback, dal più leggero

1. **Nascondere una fonte:** `update news_sources set active=false where id=…`. La RLS nasconde subito le sue notizie.
2. **Fermare l'ingestione:**
   - impostare `ALPHA_NEWS_INGEST_ENABLED=0`: la Function risponde 503;
   - disattivare il job: `select cron.unschedule('alpha-news-every-two-hours')`.
3. **Fermare la lettura dall'app:** Pages con `ALPHA_NEWS_ENABLED=0`, così il gateway rifiuta le rotte news. Con il client si torna alla build senza `cloud:news`: la scheda Notizie resta, con i soli consigli.
4. **Svuotare i contenuti:** `delete from news_items where source_id=…`. Sono notizie pubbliche e nessun dato degli utenti dipende da queste tabelle.

Non si eliminano le tabelle o le colonne in un rollback ordinario: restano vuote e inattive. Nessuna di queste operazioni tocca i documenti di sincronizzazione, il CAS o l'Auth.
