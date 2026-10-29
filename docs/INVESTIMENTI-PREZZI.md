# Investimenti: le mie quote e come si muove il mercato

Proposta del 29/10/2026, da approvare prima di scrivere codice. Branch: `feature/alpha-investments-tracking`
(partita da `integration/alpha-phase2e-ux-rc`).

## Cosa chiede Carlo

«Scrivo i miei titoli e le mie quote, e vedo come cambia il mercato per me»: prezzi che si aggiornano da soli,
variazione per ogni titolo e sul totale.

## Cosa c'è già

- **Analisi → Investi** (`src/ui/InvestmentsView.tsx`): titoli con nome, tipo (ETF, azione, obbligazione, fondo,
  crypto, altro), ticker, valuta, quote, prezzo medio di acquisto e **prezzo attuale scritto a mano**. In alto il
  valore di oggi, quanto hai investito, guadagno o perdita e rendimento. Poi conti deposito, PAC e «piano e realtà».
- **Calcoli** (`src/engine/investments.ts`, `portfolioSummary`): il valore usa `manualPrice`, altrimenti `livePrice`.
  Il campo `livePrice` **esiste ma nessuno lo scrive**: oggi i prezzi automatici non ci sono.
- **Cambi**: automatici dalla BCE tramite Frankfurter (`src/fx.ts`), gratuiti e senza chiave; i titoli in dollari
  o sterline sono già convertiti nella tua valuta.
- **Home**: il widget «Mercati» dice solo se le borse di Milano, Francoforte, Londra e New York sono aperte
  (calcolato sul telefono, niente rete). Un widget «Investimenti» **non esiste**: il valore del portafoglio compare
  solo come riga nel widget «Capitale».
- **Alpha**: `src/features.ts` non spegne nulla degli investimenti; funzionano come in produzione.
- **Sicurezza**: la CSP dell'app permette di contattare solo il sito, Supabase e `api.frankfurter.dev`.

## Cosa manca

1. **Una fonte dei prezzi** utilizzabile dal telefono, senza chiavi e permessa dalla CSP.
2. **La variazione di mercato**: oggi si vede solo il guadagno rispetto al prezzo di acquisto, non «quanto è
   cambiato oggi».
3. **Dove tenere i prezzi**: gli investimenti si sincronizzano tra dispositivi **in blocco** (vince l'ultima
   modifica). Se ogni aggiornamento dei prezzi scrivesse lì, un telefono potrebbe cancellare le quote appena
   cambiate sull'altro. I prezzi quindi **non vanno nei dati sincronizzati**.

## Le fonti dei prezzi (verificate il 29/10)

| Fonte | Cosa copre | Senza chiave | Leggibile dall'app (CORS) |
|---|---|---|---|
| CoinGecko | crypto, in euro e altre valute, con variazione 24 ore | sì (limiti bassi) | sì |
| Kraken, Binance | crypto (solo coppie di quell'exchange) | sì | sì |
| Yahoo Finance | ETF, azioni, fondi | sì, ma non ufficiale | **no** (e spesso blocca: errore 429) |
| Stooq | ETF e azioni | sì | **no** |
| Finnhub, Alpha Vantage, Twelve Data… | ETF e azioni | **no**: serve una chiave | — |

In breve: **dal solo telefono si possono avere le crypto, non ETF e azioni.** Per ETF e azioni serve una funzione
sul server che tenga la chiave segreta di un fornitore: è lavoro di server, da decidere con Federico, e nell'Alpha
il gateway oggi non lo permetterebbe. Qui lo propongo soltanto (opzione C), non lo faccio.

## La proposta (opzione A, consigliata)

**Prezzi automatici per le crypto, prezzo a mano per tutto il resto, e per tutti la variazione.**

1. **Crypto in automatico** da CoinGecko: per i titoli di tipo «Crypto» con ticker (BTC, ETH, SOL…; un piccolo
   elenco dei più comuni, oppure il nome CoinGecko, es. `bitcoin`). Una sola richiesta per tutto il portafoglio,
   al massimo ogni 10 minuti e solo mentre si guarda Investi. Si aggiunge `https://api.coingecko.com` alla CSP.
2. **Privacy**: a CoinGecko arriva solo l'elenco delle monete e la valuta, **mai quote né importi** (come oggi per
   i cambi a Frankfurter). Da scrivere nella pagina Privacy, in 4 lingue.
3. **I prezzi restano sul dispositivo** (una piccola memoria locale), non nel documento sincronizzato: niente
   conflitti tra telefoni. Il prezzo scritto a mano continua a vincere su quello automatico.
4. **Variazione per ETF e azioni con prezzo a mano**: quando aggiorni il prezzo, l'app ricorda il precedente e la
   data, così vedi «da martedì +1,8 %». Anche questo resta sul dispositivo.
5. **Cosa si vede in Investi**, senza nuove schermate:
   - nel riepilogo in alto, una riga: «Oggi +42,10 € (+0,9 %)» (o «dall'ultimo aggiornamento»);
   - su ogni titolo, accanto al rendimento: «oggi +1,2 %», in rosso se scende;
   - sotto l'elenco: «Prezzi crypto aggiornati alle 10:42 · CoinGecko» e l'ora dell'ultimo prezzo a mano;
   - senza rete o con CoinGecko che non risponde: resta l'ultimo prezzo, con l'ora; nessun errore a schermo.
6. **Cosa non si fa**: niente grafici dei prezzi, niente avvisi «il titolo è sceso», niente consigli. Resta la frase
   «non è una consulenza finanziaria».

**Home (da decidere)**: aggiungere al widget «Mercati» una riga «I tuoi investimenti oggi +0,9 %» quando hai titoli.
Nessun widget nuovo. Se preferisci tenere ferma la Home, si salta.

## Le alternative

- **B — Solo a mano, meglio**: niente rete nuova; solo il punto 4 (variazione dall'ultimo prezzo scritto). Minimo,
  ma il mercato non «si muove» da solo.
- **C — Anche ETF e azioni in automatico**: opzione A più una funzione sul server (Supabase o Cloudflare) con la chiave
  di un fornitore a pagamento o gratuito con limiti. Richiede: scelta del fornitore e dei suoi termini, lavoro sul
  server, permesso nel gateway Alpha, ok di Federico. Da fare dopo, come progetto a parte.

## Come si prova

- Test unitari: calcolo della variazione per titolo e totale (con valute diverse, prezzi mancanti, prezzo a mano
  che vince), lettura della risposta di CoinGecko, elenco dei ticker, memoria locale dei prezzi.
- Prova end-to-end (`npm run e2e`): aggiungo un titolo crypto e un ETF con prezzo a mano, cambio il prezzo e vedo la
  variazione; la risposta di CoinGecko è finta (dati sintetici, nessuna rete vera nei test).
- `tsc`, lint, test, e2e verdi; Draft PR, nessun merge; avviso a Federico per la branch e la PR.
