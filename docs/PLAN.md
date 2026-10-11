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

- **Prossimo (deciso il 12/10/2026): pagina Movimenti più interattiva.** In alto grafici e widget (per esempio spese per
  categoria, andamento del mese, confronto con il mese prima, i negozi o le voci più frequenti), in fondo alla pagina la lista
  dei movimenti. Il pulsante + resta com'è per aggiungere le spese. Restano l'import dell'estratto conto e il controllo
  "Tutto a posto".
- In attesa di una scelta: Free/Pro con abbonamento Stripe, da preparare in modalità test.

- Dominio scelto: **quadriamo.com** (verificato libero l'11/10/2026, anche quadriamo.it): da comprare presto.
  Indirizzi previsti: `admin@quadriamo.com` (accesso amministratore: in Supabase → Authentication → Users si cambia l'email
  dell'account admin di oggi), `ciao@quadriamo.com` (contatti, privacy, feedback), `noreply@quadriamo.com` (mittente delle email
  dell'app via Resend), `app.quadriamo.com` (l'app). Finché il dominio non è suo non si usano: le email finirebbero a vuoto.

- Quando prende il dominio: dati del titolare in `public/owner.js` (oggi persona fisica; aggiornare se nasce una ditta o una SRL)
  e casella email dedicata (es. ciao@quadriamo.com) come contatto di privacy, termini e pulsante feedback (`FEEDBACK_EMAIL` in `src/config.ts`).

- Prima del lancio: dominio `quadriamo.com` verificato su Resend, SMTP personalizzato in Supabase
  (Authentication → Emails → SMTP Settings: host smtp.resend.com, porta 465, utente `resend`), modelli
  "Magic link or OTP" e "Confirm sign up" con il codice `{{ .Token }}`, Site URL e Redirect URLs dell'indirizzo pubblico.

- Campagna social per la web app (immagini, caroselli, reel), come quella fatta per l'Excel.
- Logo come asset vero: versione vettoriale (SVG) e PDF del marchio Quadriamo (scritta + icona a quattro blocchi).
- Prima di far pagare il Pro: spostare l'hosting da GitHub Pages (non adatto a servizi commerciali) a un hosting adatto, es. Cloudflare Pages, con `app.quadriamo.com`.
