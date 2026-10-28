# Importazione estratti conto: compatibilità e regole (Fase 2E)

Aggiornato al 28/10/2026, sul branch `feature/phase2e-bank-import`.

Tutte le prove usano **file sintetici**, senza dati bancari reali. Qui nessuna banca è «supportata» senza un test che lo dimostri.

## Regole di lettura
- **La convenzione dei numeri si decide sull'intero file**, mai riga per riga.
  - `1.234,56`, `1 234,56`, uno spazio Unicode come separatore delle migliaia, o `1.234.567` → la virgola è il decimale.
  - `1,234.56` o `1,234,567` → il punto è il decimale.
  - `0,123` → decimale (un gruppo delle migliaia non inizia con 0).
  - `-1.234` e `-1,234` senza altri indizi nel file sono **ambigui**: l'app chiede, mostrando l'esempio letto nei due modi.
  - Se il file contiene indizi opposti, l'app chiede quale convenzione vale. Le righe scritte nell'altro modo vengono escluse e indicate.
- **Gli importi si leggono dalla stringa esatta in unità minime**, con le cifre decimali della valuta: EUR 2, JPY 0, KWD 3.
  - Più decimali del consentito: riga esclusa con il motivo «precisione», **mai arrotondata**.
  - Meno tipografico, meno finale (`1.234,56-`), parentesi contabili, simbolo o codice della valuta: tutti letti.
  - Oltre 12 cifre intere: riga esclusa con il motivo «fuori limite».
- **Ordine delle date**, ricavato dalle righe non ambigue (`28/10` è per forza giorno/mese).
  - Un'intestazione in italiano, francese, spagnolo o tedesco vale giorno/mese.
  - In inglese (Stati Uniti o Regno Unito) con tutte le date ambigue, l'app chiede.
  - Sono supportati: ISO con orario e fuso, separatori `/`, `-`, `.`, anni a due cifre, nomi dei mesi in italiano, inglese, francese e spagnolo (`1 ott 2026`, `Oct 1, 2026`, `1 octobre 2026`, `1 de octubre de 2026`, `01-Oct-2026`).
  - Le date impossibili vengono escluse con il motivo.
- **Nessuna riga sparisce in silenzio.** Ogni esclusione ha numero di record e motivo: data, importo, precisione, migliaia, fuori limite, totale/saldo, non contabilizzata, zero.
- **Anteprima obbligatoria per i CSV generici:** periodo, movimenti da importare, già importati, righe escluse, entrate, uscite, formati riconosciuti. Senza conferma non entra niente nella casella.
- **La reimportazione è idempotente.** Le righe identiche dentro lo stesso file restano distinte: le impronte di `planImport` contano le occorrenze.

## Formati

Legenda degli stati:
- **specifico:** adattatore dedicato, con test;
- **generico verificato:** letto dal motore generico, con test su un file sintetico che riproduce il tracciato;
- **non verificato:** nessuna prova.

| Banca / formato | Paese | CSV | XLSX | Convenzioni | Stato | Prova |
|---|---|---|---|---|---|---|
| Revolut, estratto consolidato in italiano | IT | sì | sì (1 foglio, 1 colonna) | `1.000,00€`, date `1 ott 2026` | specifico | `consolidatedStatement.test.ts`, e2e «Importazione» |
| Revolut, estratto consolidato annuale in inglese | EU | sì | sì | `1,000.00`, date `Jan 02, 2026` | specifico | `consolidatedStatement.test.ts`, e2e «CSV annuale» |
| Revolut, CSV dei movimenti (`Completed Date`, `State`) | EU | sì | no | segno nell'importo, stato | generico verificato | colonne riconosciute da `detectColumns`, righe non completate escluse con il motivo |
| CSV italiano generico (`Data;Descrizione;Importo`) | IT | sì | no | `;`, `1.234,56`, giorno/mese | generico verificato | `bankNumbers.test.ts`, e2e «Fase 2E» |
| CSV americano generico (`Date,Description,Amount`) | US | sì | no | `,`, `1,234.56`, mese/giorno | generico verificato | `bankNumbers.test.ts` |
| CSV francese generico (`Date;Libellé;Montant`) | FR | sì | no | `;`, `1 234,56` | generico verificato | `bankNumbers.test.ts` |
| CSV con Dare/Avere o Débit/Crédit separati | — | sì | no | due colonne senza segno | generico verificato | logica esistente, letta con la nuova convenzione |
| N26, Wise, Intesa Sanpaolo, UniCredit, Fineco, ING, BBVA, PayPal, bunq, Monzo e gli altri | — | — | — | — | non verificato | nessun tracciato pubblico verificato in questa fase |

## Non ancora fatto
In questa fase **non** sono stati fatti:
- la scelta manuale delle colonne per formati sconosciuti;
- l'XLSX generico a più fogli;
- la ricerca documentata dei tracciati delle singole banche;
- il riconoscimento della banca;
- l'identificativo originale delle transazioni per i doppioni;
- la gestione esplicita dei movimenti in sospeso poi contabilizzati.

Un file con colonne non riconosciute oggi viene rifiutato con un messaggio, non importato a metà.
