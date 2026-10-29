# Piano del mese: reddito previsto, entrate ricevute, spese fisse

Progetto del 29/10/2026, sul branch `claude/monthly-plan` (base: RC `34ed4a3`). Implementato nella stessa PR dopo le decisioni di Carlo del 29/10 (in fondo).

Richiesta di Carlo: l'app gestisce quello che si possiede adesso, non quello che si potrebbe avere. Va tolta la proiezione «a questo ritmo il mese finisce a −1.072,99 €»: con 3 giorni di dati moltiplicava la spesa media per i 28 giorni rimasti. Al suo posto:
1. si chiede quanto si prende al mese (si può cambiare);
2. si sceglie la regola;
3. si inseriscono le spese fisse, ognuna con «Conta nel mese» (sì di partenza).

Il reddito previsto è la **base del numero del giorno** (decisione di Carlo, 29/10: «l'ammontare giornaliero da spendere sia calcolato in base a quanto si ottiene mensilmente di norma»). Nel mese i soldi arrivano con una o più entrate; quello che supera il previsto è un **extra**: resta nelle parti (dove sceglie l'utente) ma non entra nel numero del giorno.

## Tre grandezze, mai mescolate

| Grandezza | Da dove viene | A cosa serve |
|---|---|---|
| **Reddito previsto** | una risposta, modificabile | il numero del giorno e «Budget del mese» |
| **Soldi reali** | saldo iniziale + riporto dal mese prima + entrate ricevute − spese reali | parti, saldi, Analisi (senza reddito previsto anche il numero del giorno, come prima) |
| **Spese fisse programmate** | pagamenti del calendario con importo e categoria | impegni messi da parte nel numero del giorno |

I saldi delle parti restano solo soldi reali: il reddito previsto non diventa mai un'entrata registrata.

## Fatti verificati nel codice di oggi (RC `34ed4a3`)
- **Spese fisse.** Un pagamento del calendario conta da solo come spesa nel suo giorno (`recurringOf`). Prima di quel giorno è «in arrivo», col suo importo previsto.
- **Doppioni.** Se l'utente registra anche a mano lo stesso pagamento, **conta due volte**. L'unica difesa è l'avviso rosso `recurringDuplicate`, quando categoria e importo coincidono esattamente.
- **Numero del giorno** (`safeToSpend`). Usa solo soldi reali: quanto resta nelle parti di spesa, meno le spese fisse ancora in arrivo, diviso i giorni che restano.
- **Saldo iniziale.** Esiste come saldo iniziale di ogni parte (`buckets[].startingBalance`), vale solo per il primo mese ed è nascosto dentro la scheda della parte. La configurazione iniziale non lo chiede: chiede il **capitale**, che resta separato dal mese.
- **Stipendio.** La configurazione lo registra come entrata reale del primo mese: è questo che mescola previsto e reale.
- **Proiezione.** La proiezione a ritmo (`forecastMonth`) compare in 5 punti: widget «Come finisce il mese», carta «Adesso», Consigli, Analisi → Mese, Calendario.

## 1. Una spesa fissa non conta mai due volte

Ogni volta di una spesa fissa nel periodo è in **uno solo** di due stati:
- **da pagare:** conta come impegno, messo da parte nel numero del giorno. Non conta come spesa;
- **pagata:** conta come spesa **una volta**, attraverso un solo movimento.

**Collegamento esplicito.** Un movimento può dire quale volta paga: `transaction.occurrence = { eventId, date }`. Una volta collegata non genera il movimento automatico e non resta in «da pagare». Ogni volta ha al massimo un movimento collegato, e ogni movimento paga al massimo una volta.

**Come nasce il collegamento:**
- **automatico, come oggi:** alla scadenza, per i pagamenti con «Conta nel mese» attivo;
- **a mano:** nel nuovo movimento, se la categoria scelta ha una volta da pagare (o appena pagata in automatico) nello stesso periodo, compare «È “Affitto” del 1 nov?». Con un tocco i due si uniscono: resta il movimento a mano, con il suo importo vero (le bollette cambiano), e quello automatico sparisce;
- **dall'import:** confermando una riga che combacia con una volta (stessa categoria, importo entro 0,5 €, data entro ±3 giorni) si propone lo stesso collegamento, come per i doppioni di oggi.

**Dati vecchi.** Nessun collegamento viene creato da solo sullo storico: un cambio silenzioso dei saldi passati sarebbe peggio del doppione. I doppioni vecchi restano segnalati come oggi, e la riga propone «Collega».

## 2. «Conta nel mese» esclude dalla pianificazione, mai un'uscita reale

Il campo è `event.planOffFrom` (una data, `null` = conta): da quel giorno in poi il pagamento è fuori dalla pianificazione.
- Le volte **da quel giorno in poi** non generano il movimento automatico, non sono messe da parte e non entrano nel numero del giorno. Restano nel calendario e i promemoria funzionano.
- Le volte **prima** di quel giorno restano com'erano: un pagamento automatico già contato è un'uscita del passato e non sparisce dai saldi.
- **Un pagamento reale conta sempre.** Un movimento registrato (anche collegato a una volta esclusa) entra nella spesa, nelle parti e nel numero del giorno come qualsiasi movimento. L'interruttore non tocca mai i movimenti.
- Riattivarlo rimette `null`. Le volte del periodo in cui era spento non tornano indietro da sole: chi le ha pagate le ha già registrate a mano.

## 3. Numero del giorno sul reddito previsto (aggiornato dopo la decisione di Carlo)

Federico chiedeva il consiglio separato dai soldi reali; Carlo ha scelto di basare il **numero del giorno** sul reddito che si prende di norma. Così uno stipendio in ritardo non abbassa il numero, e un'entrata in più non lo alza.

**Calcolo** (`engine/spend.ts`, `safeToSpend`), per ogni parte di spesa, quando c'è un reddito previsto per il periodo:
- `base = resta nella parte − entrate del mese nella parte + quota del previsto`, dove la quota è `(previsto − spese «prima delle parti») × quota della regola` (un ammanco pesa sulla prima parte, come per le entrate);
- `libero = base − spese fisse ancora da pagare nella parte`;
- `numero del giorno = Σ max(0, libero) / giorni rimasti (oggi compreso)`.

Senza reddito previsto il calcolo resta quello di prima, sui soldi reali.

**Budget del mese** (il widget al posto di «Come finisce il mese», `monthBudget`): quanto spendere al giorno; previsti, arrivati (fino al previsto), extra, spese fisse. È rosso **solo** se le spese hanno già superato il previsto nelle parti di spesa, scritto come fatto («Hai già speso più del previsto…»), mai come proiezione. Senza reddito previsto invita a impostarlo (Profilo → Budget, regola e categorie → «Quanto prendi al mese»).

In Home, sotto il numero, «Arrivati 300 € su 1.200 € previsti» finché non è arrivato tutto: si vede che il numero conta anche soldi non ancora arrivati.

**Extra.** Quando un'entrata supera il previsto, il nuovo movimento lo dice («è un extra e non cambia quanto spendere al giorno. Scegli tu dove va») e la scelta di sempre decide dove va: con la regola, tutta in una parte (anche Investimenti) o divisa a modo proprio.

Fondo di sicurezza e investimenti non entrano mai in «quanto spendere».

## 4. Saldo iniziale, stipendio a fine mese, inizio a metà mese

**La configurazione, nell'ordine chiesto da Carlo:**
1. **Quanto prendi al mese?** Diventa il reddito previsto (`settings.expectedIncome`). Non è più registrato come entrata.
2. **Quando arriva?** Il giorno dello stipendio diventa l'inizio del mese (`monthStartDay`, che esiste già, oggi solo nelle impostazioni). Lo stipendio a fine mese è così l'inizio del periodo successivo.
3. **Lo stipendio di questo periodo è già arrivato?**
   - **Sì:** è dentro il saldo di oggi. Il previsto vale dal **prossimo** periodo (`settings.expectedFrom`), così non viene contato due volte.
   - **No:** il previsto vale già da questo periodo.
4. **Quanto hai oggi?** Il saldo iniziale del primo periodo, **diviso con la regola come un'entrata** (decisione di Carlo; `buckets[].startingBalance`, che esiste già, al centesimo). `settings.balanceDate` = oggi: le spese fisse del primo periodo prima di oggi sono già fuori dal saldo e non si contano di nuovo.
5. **La regola.**
6. **Le spese fisse**, ognuna con «Conta nel mese».
7. **Il capitale.** Facoltativo e separato dal mese, come oggi.

**Casi:**
- **Inizio a metà mese, stipendio già arrivato:** numero del giorno = saldo di oggi; il previsto vale dal periodo successivo.
- **Stipendio in ritardo di qualche giorno sull'inizio del periodo:** il numero non cambia; sotto si legge quanto è arrivato.
- **Più entrate nello stesso mese:** «arrivati» sale fino al previsto; il di più è extra, nei soldi reali e non nel numero.
- **Reddito previsto cambiato a metà periodo:** il numero si ricalcola subito. Non viene salvato da nessuna parte, quindi niente da correggere nei mesi passati.

## Campi nuovi (tutti facoltativi, compatibili con dati e backup di prima)
- `Settings.expectedIncome?: number | null`
- `Settings.expectedFrom?: 'YYYY-MM' | null`
- `CalEvent.planOffFrom?: string | null`
- `Settings.balanceDate?: 'YYYY-MM-DD' | null` (aggiunto in implementazione: senza, l'affitto già pagato prima di iniziare a metà mese si contava di nuovo)
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
  - il numero del giorno non diventa mai negativo;
  - lo sforamento è scritto come fatto.
- **Reddito previsto cambiato:** il numero si ricalcola; i mesi passati non cambiano.
- **«Conta nel mese» spento:**
  - le volte future escono dalla pianificazione;
  - quelle passate automatiche restano;
  - un pagamento reale di una spesa esclusa conta.
- **Inizio a metà mese:** con lo stipendio già arrivato e non ancora arrivato.
- **Giorno dello stipendio il 27, stipendio in ritardo.**
- **Reddito previsto non impostato:** niente budget del mese, numero sui soldi reali come prima.
- **Affitto «prima delle parti».**
- **Nessun testo dell'interfaccia parla più di «ritmo»**, nelle quattro lingue.
- **e2e:** configurazione nel nuovo ordine, interruttore, collegamento di un pagamento a mano, sincronizzazione Alpha dei campi nuovi.

## Decisioni di Carlo (29/10)
1. **Saldo iniziale:** diviso con la regola come un'entrata.
2. **Spese fisse con «Conta nel mese» attivo:** pagate da sole alla scadenza, come oggi.
3. **Numero del giorno:** calcolato sul reddito che si prende di norma; le entrate oltre il previsto sono extra, vanno dove sceglie l'utente e non entrano nel numero.
4. **Widget rosso:** sostituito da «Budget del mese».

## Cosa resta fuori da questa PR
- **Collegamento dall'importazione dell'estratto conto:** il collegamento si fa nel nuovo movimento (anche aprendo un movimento importato); la proposta automatica durante l'importazione è un passo successivo.
- **e2e Alpha della sincronizzazione dei campi nuovi tra due dispositivi:** i campi viaggiano dentro impostazioni e movimenti come gli altri, con le etichette nella schermata dei conflitti; la prova a due dispositivi va fatta sull'Alpha.
