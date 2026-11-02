# Aggiornamento proposto per la Draft PR #21

## Correzioni locali

- Il widget Budget del mese mostra una sola intestazione e quattro dati: reddito previsto, ricevuto/previsto, spese previste ed entrate extra.
- La Home distingue l'obiettivo giornaliero pianificato dalla disponibilità registrata e mostra l'avviso solo quando il calcolo rileva un disavanzo non coperto.
- L'E2E Alpha verifica il fallback delle copertine e fallisce se viene tentata una richiesta immagine esterna; l'attribuzione dell'immagine non viene mostrata quando l'immagine non è presente.
- La documentazione riflette la variante B approvata.

## Stato e prove

Il commit `801c291` era già distribuito su `quadriamo-alpha`; Piano e Notizie erano e rimangono disattivati. Queste correzioni sono locali: non è stato autorizzato né eseguito un nuovo deploy.

Le verifiche eseguite in locale e con backend/browser simulati non costituiscono QA cloud delle funzionalità Piano e Notizie disattivate. Non sono state eseguite scritture Cloudflare o Supabase, migrazioni, ingestione Notizie o attivazioni di flag.
