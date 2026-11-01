# Alpha 2I — decisioni definitive e gate tecnici

## Piano: variante B approvata

Home mostra «Obiettivo giornaliero pianificato», non disponibilità bancaria. Il calcolo sostituisce le entrate correnti effettivamente allocate con il reddito previsto del periodo, mantenendo residui precedenti, spese e impegni del contratto 2I. Per lo stesso periodo e la stessa data, tranche e incassi extra non aumentano il target. La disponibilità nelle parti di spesa, sotto il numero principale, usa soltanto i saldi registrati al netto degli impegni; esclude capitale accantonato/investito nelle parti senza categorie di spesa e non certifica il saldo bancario. Nessun nuovo campo produce movimenti o scritture nei saldi.

«Reddito previsto già ricevuto» = min(previsto, entrate ordinarie). «Extra ricevuti» = categoria extraIncome più eccedenza delle altre entrate sul previsto. La somma è il totale degli incassi registrati; importi in valuta sono quelli convertiti dal motore. Le categorie di entrata personalizzate sono ordinarie finché non vengono assegnate alla categoria Extra: nessuna classificazione automatica dal testo. Le spese previste sono le scadenze attive incluse nel piano, anche se pagate/collegate; le spese effettive sono i movimenti manuali di spesa del periodo di competenza. Un automatismo non dimostra un'uscita bancaria: questo è esplicitato. Le date originali restano in cronologia/esportazioni secondo #19. Le esclusioni e balanceDate si applicano anche all'elenco delle spese previste.

Avviso: residuo monetario positivo del piano nelle parti di spesa, meno disponibilità netta registrata nelle medesime parti, meno quota spendibile delle entrate ancora previste. Le entrate attese recuperano prima l'eventuale deficit FIRST e poi seguono la regola di ripartizione, senza aggiungere denaro al ledger. Piccole differenze fino a una unità minima per parte sono tollerate per la ripartizione cumulativa. Il ritardo o una tranche futura, da soli, producono una nota sulla dipendenza dagli incassi attesi, non un allarme di insolvenza. La previsione non garantisce l'incasso: senza una data delle tranche non si può diagnosticare un ritardo di stipendio. Fondi spostati fuori dalle parti di spesa possono invece produrre un deficit reale rispetto al piano.

Preservati snapshot, firstMonth, balanceDate, planVersion1, incomePlans, CAS, backup, EUR/JPY/KWD e intervalli [from,until). Se il saldo iniziale comprende già lo stipendio, il piano iniziale conserva il previsto aggiuntivo0 e il reddito normale dal periodo successivo: nessuna doppia pianificazione della somma già fotografata. I residui precedenti fanno parte del piano del periodo seguente; non vengono riclassificati né riscritti. Nessuna proiezione «a questo ritmo» nel percorso nuovo. Investimenti 2H invariati.

## Copertine e diritti separati

Il contratto opzionale Alpha aggiunge a news_sources: image_rights_reference (URL pubblico verificabile), image_attribution, image_attribution_required (default true), image_hosts esatti, image_rights_scope (none / approved-urls / feed) e image_approved_urls. La licenza sul titolo resta rights_reference con approved_by. Il manifest di seed accetta imageRights:{allowed,reference,attribution,attributionRequired,hosts,scope,approvedUrls}; in tutti i casi active resta false. Senza una decisione esplicita allowed resta false. Scope feed richiede una copertura legale per tutte le immagini pubblicate in quel feed: la sola presenza in RSS/OG non basta. Preferire approved-urls per le autorizzazioni sul singolo file.

Ingest e frontend Alpha verificano indipendentemente i diritti: URL HTTPS pubblico senza credenziali, host esatto, riferimento licenza, ambito e attribuzione se richiesta. Un feed autorizzato non autorizza automaticamente le immagini. Il backend conserva soltanto l'URL autorizzato, senza scaricare/copiarne i byte, estratti esclusi. La scheda e il dettaglio mantengono dimensioni, sezioni e filtri con fallback grafico locale per immagine assente, negata o in errore. Nessun elemento img viene creato per URL non autorizzati; no-referrer sulle copertine. Credito e link ai diritti sono nel dettaglio. Dopo l'approvazione il browser contatta il publisher dell'immagine (anche indirizzo IP del lettore): verificare informativa privacy e affidabilità dell'host, incluso il comportamento dei redirect. Una cache offline può mantenere i metadati approvati fino all'aggiornamento: nessuna revoca istantanea promettibile offline. La produzione storica conserva la propria query e il comportamento delle immagini precedente.

## Fonti proposte, tutte inattive

Manifest revisionabile: supabase/alpha-news/sources.proposed.json. Non è un seed eseguibile: approvedBy vuoto e titleAllowed=false vengono respinti dal generatore fino all'approvazione di Carlo. Verifica al 2026-11-01: solo letture HTML/XML pubbliche, nessuna immagine reale scaricata, nessun contenuto ingerito nel database.

| Fonte | Feed | Diritti sui titoli/contenuti | Immagini |
|---|---|---|---|
| Banca d'Italia | RSS ufficiale, HTTP200,60 elementi | Policy verificata restrittiva: autorizzazione scritta; CC BY4 solo open data | Non autorizzate |
| BCE | RSS press, HTTP200,15 elementi | Riuso condizionato, attribuzione e accuratezza; eccezioni documenti firmati | Non verificate |
| Consob | Non verificato: blocco automatico/timeout | Non verificati | Non verificate |
| ISTAT | RSS, HTTP200,10 elementi | CC BY4 salvo eccezioni; terzi e marchi richiedono controllo | Non verificate singolarmente |
| MEF | RSS comunicati, HTTP200,10 elementi | Non verificati: serve riferimento ufficiale di riuso | Non verificate |
| Agenzia delle Entrate | Portale identificato, feed non verificato | Non verificati; non confondere con Entrate-Riscossione | Non verificate |
| Eurostat | RSS aggiornamenti dataset, HTTP200,1980 elementi | CC BY4 editoriale UE e riuso dati con attribuzione, eccezioni individuali | Non verificate singolarmente |

Riferimenti primari:
- Banca: https://alert.bancaditalia.it/webApp/rss?LANGUAGE=it ; https://www.bancaditalia.it/footer/copyright/
- BCE: https://www.ecb.europa.eu/home/html/rss.en.html ; https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html
- ISTAT: https://www.istat.it/altri-servizi/feed-rss/ ; https://www.istat.it/note-legali/
- MEF: https://www.mef.gov.it/comunica-con-noi/seguici/social-mef.html
- Consob: https://www.consob.it/ ; Entrate: https://www.agenziaentrate.gov.it/portale/
- Eurostat: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-detailed-guidelines/catalogue-api/rss ; https://ec.europa.eu/eurostat/help/copyright-notice

La verifica XML prova disponibilità e formato, non efficacia editoriale. Feed multilingua, vecchi contenuti, link verso altri host e categorie non pertinenti devono passare una ingestione controllata autorizzata prima di attivare la fonte. Eurostat è un catalogo ampio di dataset, con scarsa pertinenza editoriale: valutare filtro/adapter specifico oppure esclusione, mantenendo i limiti. Non sono state inventate fonti o licenze. Nessuna selezione editoriale è già approvata.

## Attivazione Alpha, ancora vietata in questo candidato

Piano: review indipendente della variante B e delle regressioni; Function Pages aggiornata prima dell'abilitazione con gate426 monthly-plan-v1; verifica CAS/reload/backup con documenti sintetici e aggiornamento client; autorizzazione di pubblicazione e runtime controllato. Tenere flag monthly-plan spento fino a questi gate, pur essendo approvata la semantica.

Notizie: Carlo sceglie fonti e rubriche/lingue, approva titoli e diritti sulle singole immagini o fallback, attribuzioni e riferimenti. Ottenere autorizzazione Banca d'Italia se selezionata e condizioni MEF; fornire feed/diritti per Consob ed Entrate oppure escluderle. Federico autorizza schema opzionale001 aggiornato e gateway002 su Supabase Alpha, pubblicazione Function alpha-news-ingest, secret server/Vault e allowlist, cron limitato e ingestione controllata. Prova reale RLS/firma/gateway/retention/errori/quote, poi ALPHA_NEWS_ENABLED e ALPHA_NEWS_BACKEND_READY. Nessuna di queste operazioni cloud è stata eseguita. Supabase Free: mantenere limiti4fonti,25elementi,1MB,9s,14giorni e monitorare quote prima di aumentare il numero di feed. Nessuna licenza commerciale o spesa assunta.

Build di rilascio qui con Piano e News OFF. Auth multi-scheda resta gate separato, non riesaminato né dichiarato risolto. Solo LOCAL e SIMULATED; nessuna prova cloud o modifica ai tester. Prossima review indipendente: formula B, avviso con FIRST/tranche/extra, snapshot iniziale; diritti/fallback immagini e schema opzionale; compatibilità426 e attivazione flag.
