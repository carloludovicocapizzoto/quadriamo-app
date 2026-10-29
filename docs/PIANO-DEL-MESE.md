# Piano del mese: reddito previsto, entrate ricevute, spese fisse

Progetto del 29/10/2026, sul branch `claude/monthly-plan` (base: RC `34ed4a3`). **Solo progetto: il codice arriva dopo l'approvazione.**

Richiesta di Carlo: l'app gestisce quello che si possiede adesso, non quello che si potrebbe avere. Va tolta la proiezione «a questo ritmo il mese finisce a −1.072,99 €»: con 3 giorni di dati moltiplicava la spesa media per i 28 giorni rimasti. Al suo posto:
1. si chiede quanto si prende al mese (si può cambiare);
2. si sceglie la regola;
3. si inseriscono le spese fisse, ognuna con «Conta nel mese» (sì di partenza).

Il reddito previsto serve solo a un **consiglio** su quanto spendere al giorno. Nel mese i soldi arrivano con una o più entrate.

## Tre grandezze, mai mescolate

| Grandezza | Da dove viene | A cosa serve |
|---|---|---|
| **Reddito previsto** | una risposta, modificabile | solo il consiglio |
| **Soldi reali** | saldo iniziale + riporto dal mese prima + entrate ricevute − spese reali | numero del giorno, parti, saldi |
| **Spese fisse programmate** | pagamenti del calendario con importo e categoria | impegni messi da parte e consiglio |

Nessuna schermata somma il reddito previsto ai soldi reali in un numero solo.

## Fatti verificati nel codice di oggi (RC `34ed4a3`)
- **Spese fisse.** Un pagamento del calendario conta da solo come spesa nel suo giorno (`recurringOf`). Prima di quel giorno è «in arrivo», col suo importo previsto.
- **Doppioni.** Se l'utente registra anche a mano lo stesso pagamento, **conta due volte**. L'unica difesa è l'avviso rosso `recurringDuplicate`, quando categoria e importo coincidono esattamente.
- **Numero del giorno** (`safeToSpend`). Usa solo soldi reali: quanto resta nelle parti di spesa, meno le spese fisse ancora in arrivo, diviso i giorni che restano.
- **Saldo iniziale.** Esiste come saldo iniziale di ogni parte (`buckets[].startingBalance`), vale solo per il primo mese ed è nascosto dentro la scheda della parte. La configurazione iniziale non lo chiede: chiede il **capitale**, che resta separato dal mese.
- **Stipendio.** La configurazione lo registra come entrata reale del primo mese: è questo che mescola previsto e reale.
- **Proiezione.** La proiezione a ritmo (`forecastMonth`) compare in 5 punti: widget «Come finisce il mese», carta «Adesso», Consigli, Analisi → Mese, Calendario.

## 1. Una spesa fissa non conta mai due volte

Ogni volta di una spesa fissa nel periodo è in **uno solo** di due stati:
- **da pagare:** conta come impegno, messo da parte nel numero del giorno e tolto nel consiglio. Non conta come spesa;
- **pagata:** conta come spesa **una volta**, attraverso un solo movimento.

**Collegamento esplicito.** Un movimento può dire quale volta paga: `transaction.occurrence = { eventId, date }`. Una volta collegata non genera il movimento automatico e non resta in «da pagare». Ogni volta ha al massimo un movimento collegato, e ogni movimento paga al massimo una volta.

**Come nasce il collegamento:**
- **automatico, come oggi:** alla scadenza, per i pagamenti con «Conta nel mese» attivo;
- **a mano:** nel nuovo movimento, se la categoria scelta ha una volta da pagare (o appena pagata in automatico) nello stesso periodo, compare «È “Affitto” del 1 nov?». Con un tocco i due si uniscono: resta il movimento a mano, con il suo importo vero (le bollette cambiano), e quello automatico sparisce;
- **dall'import:** confermando una riga che combacia con una volta (stessa categoria, importo entro 0,5 €, data entro ±3 giorni) si propone lo stesso collegamento, come per i doppioni di oggi.

**Dati vecchi.** Nessun collegamento viene creato da solo sullo storico: un cambio silenzioso dei saldi passati sarebbe peggio del doppione. I doppioni vecchi restano segnalati come oggi, e la riga propone «Collega».

## 2. «Conta nel mese» esclude dalla pianificazione, mai un'uscita reale

Il campo è `event.planOffFrom` (una data, `null` = conta): da quel giorno in poi il pagamento è fuori dalla pianificazione.
- Le volte **da quel giorno in poi** non generano il movimento automatico, non sono messe da parte e non entrano nel consiglio. Restano nel calendario e i promemoria funzionano.
- Le volte **prima** di quel giorno restano com'erano: un pagamento automatico già contato è un'uscita del passato e non sparisce dai saldi.
- **Un pagamento reale conta sempre.** Un movimento registrato (anche collegato a una volta esclusa) entra nella spesa, nelle parti e nel numero del giorno come qualsiasi movimento. L'interruttore non tocca mai i movimenti.
- Riattivarlo rimette `null`. Le volte del periodo in cui era spento non tornano indietro da sole: chi le ha pagate le ha già registrate a mano.

## 3. Il consiglio è separato dai soldi che si hanno

Due numeri, due etichette, mai sommati:
- **Numero del giorno** (in alto in Home): solo soldi reali, come oggi. Non cambia.
- **Consiglio del mese** (al posto di «Come finisce il mese»): si basa sul reddito previsto e lo dice.

Esempio, reddito previsto 1.200 €, arrivati 300 €:
> **Consiglio del mese** · fino al 26 nov
> Circa **24 € al giorno** per rispettare la regola, **se arrivano i 900 € che mancano**
> **Con quello che hai adesso: 6 € al giorno**
> Previsti 1.200 € · arrivati 300 € · spese fisse 450 €

- Quando i soldi reali bastano meno del consiglio (le entrate non sono ancora arrivate), la riga «Con quello che hai adesso» viene **prima** ed è quella in evidenza. Il consiglio sta sotto, con la condizione scritta.
- Quando è arrivato tutto (o di più), c'è una riga sola: il consiglio coincide coi soldi reali.
- Senza reddito previsto non c'è consiglio. Restano i soldi reali e un invito a impostarlo.
- Il consiglio non scende mai sotto zero al giorno. Se le spese hanno già superato il previsto, è scritto come fatto («Hai speso 80 € più del previsto per le parti di spesa»), mai come proiezione.

**Calcolo.** Per ogni parte di spesa, le stesse del numero del giorno:
- `reale = resta nella parte − spese fisse da pagare nella parte` (è il numero di oggi);
- `ancora da ricevere = max(0, reddito previsto − entrate ricevute nel periodo)`: tutte le entrate, stipendio ed extra;
- `consiglio della parte = reale + ancora da ricevere × quota della parte`. È quello che la parte avrebbe se il resto arrivasse oggi, diviso con la regola. L'affitto «prima delle parti» è già tolto, perché è conteggiato tra le spese da pagare;
- `consiglio al giorno = Σ max(0, consiglio della parte) / giorni rimasti (oggi compreso)`;
- `con quello che hai adesso al giorno = Σ max(0, reale) / giorni rimasti`.

Fondo di sicurezza e investimenti non entrano mai in «quanto spendere».

## 4. Saldo iniziale, stipendio a fine mese, inizio a metà mese

**La configurazione, nell'ordine chiesto da Carlo:**
1. **Quanto prendi al mese?** Diventa il reddito previsto (`settings.expectedIncome`). Non è più registrato come entrata.
2. **Quando arriva?** Il giorno dello stipendio diventa l'inizio del mese (`monthStartDay`, che esiste già, oggi solo nelle impostazioni). Lo stipendio a fine mese è così l'inizio del periodo successivo.
3. **Lo stipendio di questo periodo è già arrivato?**
   - **Sì:** è dentro il saldo di oggi. Il previsto vale dal **prossimo** periodo (`settings.expectedFrom`), così non viene contato due volte.
   - **No:** il previsto vale già da questo periodo.
4. **Quanto hai oggi per le spese?** Il saldo iniziale del primo periodo, diviso nelle parti (`buckets[].startingBalance`, che esiste già). Copre chi parte con soldi già sul conto e chi inizia a metà mese.
5. **La regola.**
6. **Le spese fisse**, ognuna con «Conta nel mese».
7. **Il capitale.** Facoltativo e separato dal mese, come oggi.

**Casi:**
- **Inizio a metà mese, stipendio già arrivato:** numero del giorno = saldo di oggi. Nessun consiglio fino al prossimo stipendio, oppure il consiglio coincide col reale, perché non c'è niente «ancora da ricevere».
- **Stipendio in ritardo di qualche giorno sull'inizio del periodo:** il reale è basso. Il consiglio dice «se arrivano i 1.200 € previsti», e la riga in evidenza è quella dei soldi che ci sono.
- **Più entrate nello stesso mese:** «ancora da ricevere» cala a ogni entrata e si ferma a 0. Il di più va solo nei soldi reali.
- **Reddito previsto cambiato a metà periodo:** il consiglio si ricalcola subito. Non viene salvato da nessuna parte, quindi niente da correggere nei mesi passati.

## Campi nuovi (tutti facoltativi, compatibili con dati e backup di prima)
- `Settings.expectedIncome?: number | null`
- `Settings.expectedFrom?: 'YYYY-MM' | null`
- `CalEvent.planOffFrom?: string | null`
- `Transaction.occurrence?: { eventId: string; date: string } | null`

Note:
- La validazione dei dati salvati non rifiuta i campi nuovi.
- La schermata dei conflitti di sincronizzazione ha un'etichetta per ogni campo: vanno aggiunte, nelle quattro lingue.
- Va provata in e2e Alpha la modifica dello stesso pagamento da due dispositivi.

## Cosa sparisce
`forecastMonth` (la proiezione a ritmo) e le sue frasi: «A questo ritmo…», «Stima: a questo ritmo…», «sforerai a fine mese». Sparisce dalle 5 schermate e dai consigli.

## Test previsti
- **Più entrate nello stesso mese:** «ancora da ricevere» scende e si ferma a 0; il di più va solo nel reale.
- **Spese fisse già pagate:**
  - automatica, contata una volta;
  - collegata a mano, contata una volta e con l'importo vero;
  - non collegata e identica: avviso come oggi.
- **Abbonamento annuale:** entra solo nel periodo in cui cade, messo da parte e non spalmato. Nei consigli compare in anticipo tra le spese in arrivo.
- **Importi negativi:**
  - un rimborso registrato come spesa negativa riduce la spesa;
  - il consiglio al giorno non diventa mai negativo;
  - lo sforamento è scritto come fatto.
- **Reddito previsto cambiato:** il consiglio si ricalcola; i mesi passati non cambiano.
- **«Conta nel mese» spento:**
  - le volte future escono dalla pianificazione;
  - quelle passate automatiche restano;
  - un pagamento reale di una spesa esclusa conta.
- **Inizio a metà mese:** con lo stipendio già arrivato e non ancora arrivato.
- **Giorno dello stipendio il 27, stipendio in ritardo.**
- **Reddito previsto non impostato:** nessun consiglio, solo il reale.
- **Affitto «prima delle parti».**
- **Nessun testo dell'interfaccia parla più di «ritmo»**, nelle quattro lingue.
- **e2e:** configurazione nel nuovo ordine, interruttore, collegamento di un pagamento a mano, sincronizzazione Alpha dei campi nuovi.

## Decisioni ancora aperte (per Carlo)
1. **Saldo iniziale:** diviso con la regola come un'entrata (proposta: coerente con il resto), oppure tutto nelle parti di spesa?
2. **Spese fisse con «Conta nel mese» attivo:** pagate da sole alla scadenza, come oggi (proposta: niente cambia per chi le usa già), oppure solo quando si tocca «Pagato»?
