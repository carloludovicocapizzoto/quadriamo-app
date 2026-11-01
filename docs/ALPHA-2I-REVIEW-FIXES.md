# Contratto dopo la review 2I

Il budget del Piano usa il reddito abituale previsto del periodo, al netto delle spese e degli impegni pertinenti e diviso per i giorni residui. Saldo iniziale e riporto finanziano solo la disponibilità registrata. Il Piano non genera movimenti né modifica la ripartizione contabile.

`openingIncomeReceived` indica esclusivamente il reddito ordinario già compreso nello snapshot del primo periodo: riduce gli incassi ancora attesi, senza ridurre il reddito di riferimento del piano. Non è un accredito. Nei backup del prototipo 2I, il primo incomePlan a zero con snapshot e expectedIncome positivo conserva la precedente intenzione “già ricevuto”; viene interpretato senza riscrivere i dati. Nei nuovi documenti zero significa budget zero. Il campo è opzionale e validato. La versione snapshot resta 1; una revisione del reddito su archivio legacy non inventa balanceDate o planVersion.

Il rilevamento centralizzato di capacità intercetta anche campi parziali/nulli e intervalli vuoti, proteggendo lettura e scrittura senza bloccare archivi privi di pianificazione. Il 426 conserva documenti e outbox; l’interfaccia usa lo stato aggiornamento richiesto. Pubblicare la Function prima di abilitare il Piano rimane un gate obbligatorio.

La compatibilità del vecchio snapshot riconosce soltanto la firma dell’onboarding: primo periodo a zero e periodo successivo al reddito abituale. Uno zero esplicito salvato dalle impostazioni (senza quel secondo elemento) resta un budget zero; le successive revisioni conservano separatamente la quota già ricevuta.

## Copertine Alpha: solo fallback

Nessuna immagine esterna viene caricata dalla UI Alpha, anche con metadati di diritti approvati. Produzione storica invariata. Attribuzioni, filtri e sezioni restano disponibili.

`alpha-news-image.ts` prepara esclusivamente il validatore server, senza rotta, trasporto di produzione o attivazione. Rifiuta ogni redirect, anche sullo stesso host, errori, SVG/HTML, MIME e firme discordanti, risposte oltre 256 KiB; timeout 5 secondi. I test usano un server sintetico locale.

Prima di collegarlo a una rotta occorrono: un trasporto che risolva e blocchi tutti gli IP privati/riservati e pinni la connessione all’IP verificato con verifica TLS del nome (fetch standard non basta); metadati diritti recuperati dal server per ID immagine e non forniti dal chiamante; autenticazione/gateway e admission esistenti, cache limitata, rate limit, nessun cookie/token inoltrato, header Content-Type/nosniff e CSP raster; approvazione fonte/titolo/immagine e attribuzione. Fino a verifica di questi gate il validatore non è un proxy pubblicabile e la UI resta fallback. Nessuna nuova infrastruttura o immagine reale è stata utilizzata.
