# Consolidamento Alpha 2H

Base approvata: 0d24afd4ef24adde0b0f3f659af97b8e9f2abde4. Solo branch locale integration/alpha-complete-candidate; nessun push, merge PR o deploy autorizzato.

## Registro delle PR aperte (verifica Git del 1 novembre 2026)

| PR | Stato nel candidato | Azione suggerita dopo verifica di Carlo |
|---|---|---|
| #2, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14 | Tutti gli HEAD sono antenati di 0d24afd: già inclusi | Valutare chiusura come superate; nessuna ulteriore integrazione |
| #15, #19 | HEAD approvati inclusi per ancestry | Conservare riferimento review; nessun merge necessario |
| #18 | Integrata con merge locale e adattamenti, test sintetici | Revisione del nuovo candidato |
| #17 | Flag integrato; backend Alpha opzionale preparato e disattivato | Approvare fonti prima di abilitare; autorizzazioni infrastrutturali a Federico |
| #16 | Parte sicura preparata separatamente, UI sperimentale spenta | Decisione congiunta sul numero principale e contratto inizializzazione; dettagli sotto |

## Investimenti

Crypto: CoinGecko pubblico senza account, solo identificativi monete e codici valuta; nessuna quantità, saldo, valore o documento finanziario trasmesso. Credentials omit, no-referrer, timeout 15 s, tentativi limitati a dieci minuti per schermata, niente retry serrato su 429. Il servizio pubblico non offre SLA; limiti globali possono comunque produrre 429. Manuale prioritario, ETF/azioni/fondi manuali. Cache locale per account/ambiente, callback tardive invalidate con ScopeLease, dati corrotti/nonfiniti scartati, cache prezzi scaduta dopo 24 ore. Nessun dispatch/sync dei prezzi automatici. Attribuzione CoinGecko nel riepilogo prezzi.

Limite: at è l'ora della risposta ricevuta, non una certificazione della freschezza del mercato da parte del fornitore. Non presentare i prezzi come eseguibili. Prezzi manuali e quantità appartengono al documento dell'utente; solo i prezzi automatici e lo storico accessorio restano locali.

Prezzi automatici ETF/azioni: proposta concreta di adapter SERVER separato. Richiesta solo (ISIN oppure ticker+MIC, currency), risposta (instrumentId, price, currency, asOf, source, delayed), cache server per strumento/valuta con TTL deciso dal contratto; mai portafoglio/quantità. Chiave provider solo secret server. Frontend usa lo stesso modello di cache locale e priorità manuale; nessuna modifica CAS. Nessun adapter remoto scelto o acquistato. Carlo sceglie copertura borse/ISIN, ritardo accettabile e licenza di ridistribuzione; Federico autorizza eventuale account/costo dopo preventivo. Dopo la scelta si implementa un adapter e si valida il payload con risposte sintetiche e sandbox del fornitore autorizzata.

Riferimenti servizio: https://support.coingecko.com/articles/5125303456-what-is-the-rate-limit-for-coingecko-api-public-plan ; https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses . I diritti commerciali/redistribuzione sono un gate prima di uso commerciale; nessun piano pagato attivato. I test di questa fase non chiamano CoinGecko reale. I permessi di accesso Investimenti dei piani tester sono conservati, non aggirati.

## Notizie: pacchetto opzionale

Nessuna fonte attiva o seed editoriale. supabase/alpha-news/001_schema.sql: news_sources/news_items, RLS lettura autenticata solo per fonti attive, nessuna scrittura end-user, anon senza grant. Fonte disattivata nasconde anche i suoi articoli. Le collezioni usano cluster come campo, senza tabella separata news_clusters (coerente col client esistente).

002_gateway.sql richiede il gate Alpha già installato; estende firma HMAC e ammissione alle due tabelle. Pages richiede ALPHA_NEWS_ENABLED=1 e consente esclusivamente GET/HEAD. La sola eccezione diretta PostgREST per service_role riguarda news_items/news_sources e serve all'ingestione; nessuna eccezione per profili, sincronizzazione o altri dati. Migrazioni non applicate al cloud.

alpha-news-ingest è una Function separata e DISABILITATA salvo ALPHA_NEWS_INGEST_ENABLED=1. Segreti: CRON_SECRET e SUPABASE_SERVICE_ROLE_KEY (solo server); variabili: NEWS_ALLOWED_HOSTS e SUPABASE_URL esatta Alpha. Ogni chiamata sceglie al massimo quattro fonti per last_attempt; timeout 9s, max 1MB/feed, 25 elementi/feed, redirect rifiutati, host HTTPS in allowlist. Deduplica URL canonico+upsert ignoreDuplicates, clustering sulle ultime48h, conservazione14giorni. Titolo/link/testata soltanto: excerpt e thumb forzati null. Gli errori di lettura/upsert/retention/stato fonti sono visibili, nessun falso successo del job.

Cron proposto ogni due ore, massimo12 invocazioni/giorno (~360/mese): quattro feed in parallelo rientrano nel limite Free di150s; il carico effettivo e lo spazio vanno misurati prima di ampliare le fonti. Nessun cron attivato. Template separato cron.sql.example con riferimenti Vault, mai valori reali. Free ha quote di invocazioni/egress/database: nessuna promessa di capacità illimitata. https://supabase.com/docs/guides/functions/limits ; https://supabase.com/docs/guides/functions/pricing .

Carlo deve approvare una lista precisa (nome, feed HTTPS, lingua, diritti di riuso del titolo, eventuali immagini/estratti). RSS pubblico non equivale a licenza di ripubblicazione. Raccomandazione: partire con fonti istituzionali e soli metadati/link, immagini ed estratti spenti. Le fonti private/non approvate restano inattive. Dopo la decisione: preparare seed dei soli host approvati e test ingestion completi; Federico autorizza applicazione delle due migrazioni su Alpha, deploy alpha-news-ingest, inserimento secret, Vault/cron e ALPHA_NEWS_ENABLED. Poi eseguire una ingestione controllata, verificare errori/dedup/RLS/lettura account autorizzato; solo allora build con ALPHA_CLOUD_FEATURES=news e ALPHA_NEWS_BACKEND_READY=1. Fallback Alpha a vecchia Edge Function news disabilitato: nessuna chiamata a endpoint inesistenti. Cache Hub separata per account e lease.

## Piano mensile: decisione isolata

NON è stato importato il vecchio month.ts, TxForm.tsx, spend.ts o transaction.occurrence. P1-01/P1-02, divisione cumulativa e date originali restano quelli approvati. API monthPlanning separata, expectedIncome/expectedFrom opzionali; nessuna entrata fittizia, nessun cambiamento ai saldi o al numero principale. Helper saldo iniziale usa allocate con precisione EUR/JPY/KWD. Campi preservati dai normali backup/CAS; etichette dei conflitti aggiunte. UI separata in quattro lingue dietro flag monthly-plan SOLO Alpha, spento di default; backend readiness news non lo accende.

Federico+Carlo devono scegliere fra (A raccomandata) numero principale sulla disponibilità del modello #19 e obiettivo pianificato separato, oppure (B) principale sul previsto, con rischio di indicare spendibilità prima dell'arrivo dei soldi. Prototipo locale prepara A; non attivare il flag per una release finché non approvato insieme. Dopo decisione si completa un unico percorso onboarding/piano e relativa e2e, senza semantica ibrida.

Problema concreto nel progetto originale #16: planOffFrom='2026-11-01' esclude una scadenza del 2/11; riattivare impostando null il10/11 ripristina retroattivamente quella spesa automatica. Non importato. Soluzione raccomandata per «Conta nel mese»: intervalli di esclusione [from,until), chiudere l'intervallo alla riattivazione, senza cancellare la storia; una spesa reale continua a contare e i collegamenti usano validLink della #19. Questo richiede nuovo contratto temporale/backup e test di scadenze prima/dopo, due toggle, cambio anno, firstMonth, reload e movimenti reali. Il vecchio toggle non è attivo nel candidato.

Onboarding saldo iniziale/balanceDate e rimozione completa delle proiezioni nelle cinque schermate non attivati in parte: restano nel progetto #16 finché si approva il contratto del piano. Il prototipo gated sostituisce solo il widget Home, non dichiara completata #16. Collegamenti pagamento-scadenza già completamente inclusi dalla #19, nessuna duplicazione.

## Infrastruttura

Il precedente HOLD era un limite d'accesso. Docker/helper Wrangler4.151.2 recuperati; letture cloud confermano progetto quadriamo-alpha Direct Upload, Production c26d4468-5f0d-415f-a824-76966e2f61f4 source ef7ff9f e secret ALPHA_GATEWAY_KEY_HEX cifrato. Precedenti99b55952 e4484dca7 restano nell'elenco. Nessun deploy/secret/migrazione/cron modificato. Auth multi-scheda resta gate separato: nessuna nuova attestazione reale.

Per pubblicare il branch o aprire Draft PR serve autorizzazione di Federico al push del candidato e risultati. Il successivo deploy richiede propria autorizzazione puntuale. Nessuna azione assegnata a Carlo per infrastruttura che Federico può autorizzare.
