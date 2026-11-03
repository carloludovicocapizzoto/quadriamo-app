# Piano mensile — evidenze QA 2J/2K

Aggiornato 2026-11-02 sulla base dei checkpoint locali e della prova Production descritta sotto. Non è una nuova attestazione dell'attuale stato Cloudflare del 2026-11-03.

## Release osservata

- Ultimo deployment Production verificato: `3d521481-176d-4a34-929c-42ee592f8fbe`.
- Sorgente: `88cde4b3d37aa5fc9f56e7ae9fd803342e145a9f`.
- Piano ON, feed News OFF.
- Smoke pubblico: asset, manifest, service worker e Pages Function PASS; richiesta RPC anonima `401 ALPHA_AUTH_REQUIRED`; rotta News negata. L'upgrade PWA con outbox reale non è stato dimostrato in Production.

## Prova Production autenticata dell'avviso

Account di test: solo alias `QA C`; nessuna email o UUID viene riportato.

1. Backup ufficiale esportato prima della prova, revisione 16; JSON parseabile e struttura integra, 5 movimenti sintetici, campi Piano presenti. File conservato fuori dal repository e non pubblicato. SHA-256 del file: `0DA58F4E783BF6017695AE4DCCD7C99F810919BFA1E3B6629A6E84B177106C8D`.
2. Baseline osservata: obiettivo giornaliero `38,76 €`, disponibilità registrata `861,48 €`, reddito previsto `1.500 €`, ricevuto `100 €`, extra `50 €`.
3. Una sola entrata sintetica `1.400 €`, allocata interamente a Investimenti, con marker `QA-2J-PLAN-SHORTFALL-TEST-20261102`. La disponibilità registrata è rimasta `861,48 €`; l'app ha mostrato l'avviso di insufficienza `262,50 €`, mantenendo distinto l'obiettivo `38,76 €` e il reddito previsto.
4. Dopo reload della PWA Production, l'avviso era ancora visibile: persistenza/sincronizzazione del caso confermata. Non è stato creato un movimento fittizio dal calcolo del Piano: il test era un movimento sintetico esplicito.
5. La rimozione del marker è stata tentata dalla UI normale. La conferma del browser non è stata verificabile: l'ultima lettura autorevole prima dell'ultimo tentativo mostrava ancora il marker alla revisione cloud 17. **Stato finale da riconciliare prima di altre scritture; non dichiarare ripristinata la baseline.** Nessun restore usato.

## Budget scritture e stato backup

- Budget autorizzato originario per QA C: 20 scritture complessive; checkpoint precedente: 17/20, restore 2/2 già consumati.
- Aggiunta del marker: una scrittura confermata (revisione 16 → 17); conteggio certo 18/20.
- La rimozione potrebbe essere stata accettata ma non è stata verificata dopo il dialogo; trattare prudenzialmente il budget come fino a 19/20 e non scrivere ancora.
- Il backup è la baseline pre-test. Il suo contenuto non è incluso in Git. Il confronto storico con la revisione 14 aveva una differenza di tombstone; non si afferma identità byte per byte fra revisioni.

## Gate conservati dai checkpoint precedenti

| Gate | Evidenza registrata | Stato |
|---|---|---|
| CAS stale | Rifiuto della revisione obsoleta e preservazione della più recente, QA 2J | CLOUD PASS, non ripetuto |
| Compatibilità 426 | Client incompatibile bloccato senza cancellare outbox, QA 2J | CLOUD PASS, non ripetuto |
| Sync, snapshot, backup/restore, isolamento utenti | QA 2J con dati sintetici e account autorizzati | CLOUD PASS, non ripetuto |
| Avviso di insufficienza | PWA Production, fixture sintetica sopra | CLOUD PASS, fixture da riconciliare |
| Onboarding su archivio vuoto | Nessun archivio QA vuoto autorizzato | BLOCKED |
| Upgrade PWA con outbox pendente sulla stessa origine Production | Solo prova locale/simulata precedente | SIMULATED PASS; CLOUD BLOCKED |
| Auth multi-scheda | Gate separato | Non certificato |

## Prossimo controllo per Carlo

Aprire QA C nella PWA Alpha, cercare il marker esatto e leggere la revisione cloud. Se ancora presente, eliminarlo soltanto tramite la normale UI e verificare revisione e assenza dopo reload. Non importare il backup e non cancellare cache/outbox. Prima di ulteriori modifiche, riconciliare il contatore scritture.
