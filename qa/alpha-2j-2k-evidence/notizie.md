# Notizie Alpha — evidenze e gate 2I / candidato finale

## Identità del candidato

- Commit sorgente News già pubblico: `56dd86996d2a96372272ec9ffb0f24ec67a15854` (`claude/alpha-news-sources`).
- Candidato locale di consolidamento: `4701c884a76540ea01b5a243ddfa9542b5c4f2d2`, parent diretto `56dd869`; `88cde4b3` è un antenato.
- Il delta `56dd869..4701c884` modifica quattro file: documentazione News, esempio cron, manifesto fonti e test. Nessuna modifica a dati Cloudflare/Supabase. `git diff --check` PASS.
- Pubblicato senza merge il 2026-11-03 su `integration/alpha-final-candidate` (SHA `4701c884a76540ea01b5a243ddfa9542b5c4f2d2`). Nessuna PR o deploy creati.

## Backend Alpha secondo il checkpoint operativo

- Migrazioni/schema/policy `001`–`003`, gateway e Edge Function `alpha-news-ingest` risultano applicati/distribuiti e verificati.
- Seed: `ecb-press`, `ecb-stats`, `istat`; tutte le fonti inattive e senza immagini. Ingestione manuale precedente: 7 + 4 + 5 titoli; seconda ingestione idempotente, totale 16 articoli unici, senza estratti né immagini.
- `ALPHA_NEWS_INGEST_ENABLED=0`; feed pubblico OFF.
- Lettura anonima negata (`401`, SQLSTATE `42501`). Una lettura con JWT di utente autenticato non è ancora attestata.
- Nessun cron `alpha-news-*`; `pg_net` non installato; nessuna schedulazione attiva.
- Il template cron mantiene JWT verification ON, richiede un JWT invoker non privilegiato e il segreto applicativo da Vault; non usare service-role JWT e non disabilitare la verifica JWT come scorciatoia.

## Eurostat

- Feed Atom ufficiale, percorso `/eurostat/product`, URL di esempio e licenza editoriale CC BY 4.0 verificati localmente il 02/11/2026.
- La fonte resta `hold`, non seminata, non attiva e non inclusa nell'allowlist Alpha; l'egress dal runtime backend non è stato provato. Titoli e link soltanto; nessun estratto, immagine o logo.
- Prima di abilitarla: approvare l'estensione host `ec.europa.eu`, fare una prova server-side controllata di URL/redirect, una ingestione manuale e una seconda prova d'idempotenza; poi autorizzare separatamente l'attivazione.

## Gate residui

1. RLS: prova con JWT utente normale che veda zero righe quando tutte le fonti sono inattive; non confondere con la prova anonima.
2. Eurostat: egress backend e autorizzazione esplicita ancora mancanti.
3. Scheduler: preflight di `pg_cron`, `pg_net`, Vault e JWT invoker; unico job ogni due ore soltanto dopo gate e autorizzazione. Non installare estensioni o creare job per questo handoff.
4. UI pubblica: resta News OFF finché RLS, fonti, ingestion, scheduler e gate di release sono chiusi.

Nessuna prova cloud è stata ripetuta durante la preparazione di questa consegna.

## Verifica del candidato in questa consegna

- `git diff --check` sul delta `56dd869..4701c884`: PASS; il worktree sorgente era pulito.
- La suite riportata come PASS per il candidato News precedente non è stata rieseguita. Il test mirato aggiunto/aggiornato in `4701c884` non è stato eseguito in questo ambiente: `npm`/Node non sono disponibili nel terminale. Eseguire `npm test -- tests/alpha-news-first-release.test.ts` prima dell'integrazione.
