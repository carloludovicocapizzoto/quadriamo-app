# Piano di Quadriamo web app

Obiettivo: una web app installabile (PWA) con Free e Pro, prima di valutare gli store.
Si costruisce una piccola base di utenti, poi si decide come monetizzare.

## Fasi

| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Repo, motore di calcolo con test (stessi numeri dell'Excel), 4 lingue, stile, PWA installabile | **fatto** |
| 1 | Versione Free locale: inserimento rapido da telefono, elenco movimenti, bucket, controlli, ricorrenti, impostazioni (regola, categorie, giorno di inizio). Dati sul dispositivo (IndexedDB), funziona offline | **fatto** |
| 2 | Account (login via email) e sincronizzazione PC ↔ telefono (Supabase, server UE); esportazione CSV; cancellazione account | **fatto** (manca il codice nell'email: vedi sotto) |
| 3 | Pro: storico di più mesi e riepilogo annuale (scheda Anno), valute con cambi automatici BCE e cambio salvato su ogni movimento, investimenti (portafoglio, conti deposito, PAC, piano e realtà) | **fatto** (divisione Free/Pro con la fase 5) |
| 4 | Beta con un gruppo ristretto; test "primo stipendio + 5 spese" con persone nuove | da fare |
| 5 | Monetizzazione: abbonamento (Stripe), accesso Pro | quando ci sono utenti |

Dopo: import dell'estratto conto (CSV), collegamento con le banche (open banking, PSD2) solo se richiesto.

## Principi

- I calcoli stanno nel motore (`src/engine`), mai nell'interfaccia; ogni regola ha un test.
- Privacy dal primo giorno: dati in UE, esportazione e cancellazione, nessun tracciamento invasivo.
- Telefono prima di tutto: una spesa si registra in pochi secondi.
- Quattro lingue sempre allineate: una chiave nuova va aggiunta in tutti i dizionari.

## Da fare oltre alle fasi

- Prima del lancio: dominio `quadriamo.com` verificato su Resend, SMTP personalizzato in Supabase
  (Authentication → Emails → SMTP Settings: host smtp.resend.com, porta 465, utente `resend`), modelli
  "Magic link or OTP" e "Confirm sign up" con il codice `{{ .Token }}`, Site URL e Redirect URLs dell'indirizzo pubblico.

- Campagna social per la web app (immagini, caroselli, reel), come quella fatta per l'Excel.
- Logo come asset vero: versione vettoriale (SVG) e PDF del marchio Quadriamo (scritta + icona a quattro blocchi).
- Rendere pubblico questo repository per mostrarlo sul profilo GitHub.
