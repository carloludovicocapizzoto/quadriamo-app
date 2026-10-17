# Novità di Quadriamo

Una voce per versione, dalla più recente. Il numero tra parentesi nell'app (es. 0.9.0 (146)) è la build:
cresce a ogni modifica pubblicata, così ogni segnalazione dei tester indica esattamente quale codice stavano usando.
Come si pubblica una nuova versione: docs/RELEASE.md.

## 0.20.1 — 17 ottobre 2026 · più veloce con tanti dati

- Con molti mesi di movimenti la Home si apre in metà tempo e tornarci da un'altra sezione è immediato: i mesi già calcolati
  non si ricalcolano più a ogni cambio di schermata (con 2 anni di dati, su un telefono medio: ritorno alla Home da 0,30 a 0,08 s).
- Centro assistenza con le funzioni nuove, nelle 4 lingue.

## 0.20.0 — 17 ottobre 2026 · widget

- Tre widget nuovi per la Home: «Questo mese» (il calendario in miniatura con un punto per tipo, i giorni più pesanti
  e quanto resta da pagare), «Abbonamenti» (quanto costano in un anno, i monogrammi dei più cari, gli aumenti) e
  «Documenti» (la prossima scadenza). Ognuno apre la sua pagina e compare solo se ci sono dati.
- «Prossimi pagamenti» con i monogrammi e i giorni che mancano (oggi, domani, tra 3 giorni).
- Preferiti: la stella nella galleria dei widget; i preferiti restano sempre in cima alla Home.
- I widget entrano uno dopo l'altro all'apertura della Home.

## 0.19.0 — 17 ottobre 2026 · ricevuta del mese

- Analisi → Mese → «Ricevuta del mese»: il mese come uno scontrino. Categorie dalla più cara (con quante volte),
  entrate, uscite, risparmio e quanto investito, quanto resta, confronto col mese prima, la categoria più cara,
  le spese per parte con le barre, le curiosità del mese (il giorno più caro, in quanti giorni hai segnato le spese,
  quanto hai messo da parte, le piccole spese, la più grande) e un codice a barre.
- Condividi (immagine dal menu del telefono), Salva immagine, PDF (stampa del sistema). L'immagine si crea sul
  telefono: identica alla pagina, nessun server.
- Nei primi cinque giorni del mese, «Adesso» avvisa che la ricevuta del mese finito è pronta.

## 0.18.0 — 17 ottobre 2026 · Adesso

- Home → «Adesso», sotto il numero del giorno: risponde a "cosa devo fare oggi?". Un titolo (quante cose chiedono
  un'azione, oppure "niente di urgente"), le prime tre voci e le altre a richiesta.
- Cosa può comparire, in ordine di urgenza: pagamenti da seguire scaduti (con «Fatto»), i pagamenti di oggi, documenti
  scaduti o in scadenza, il mese che a questo ritmo finisce sotto zero, il prossimo pagamento, un abbonamento aumentato,
  una categoria molto sopra il solito (solo spese variabili), la prossima entrata, la sera le spese non ancora segnate,
  un obiettivo in scadenza e indietro. Ogni voce porta dove serve.
- Solo regole, calcolate sul telefono.

## 0.17.0 — 17 ottobre 2026 · documenti

- Profilo → Documenti: carta d'identità, patente, assicurazioni, contratti… divisi per categoria (personali, auto, casa,
  salute, lavoro, altro), con lo stato a colpo d'occhio (valido, tra N giorni, scaduto) e in cima la prossima scadenza.
- Nomi già pronti per ogni categoria, promemoria (di partenza 30 e 7 giorni prima), «Rinnovato» con la nuova scadenza e la
  cronologia dei rinnovi. I documenti compaiono nel calendario e i promemoria arrivano come le altre notifiche.
- Solo nome e date: nessuna scansione e nessun numero di documento.

## 0.16.0 — 17 ottobre 2026 · costo annuale

- Profilo → Abbonamenti → Costo annuale: ogni abbonamento è un blocco grande quanto costa in un anno (treemap squarified,
  disegnata da noi), tinto nel colore del servizio.
- Toccando un blocco: al mese, in un anno, categoria, ripetizione, storico degli aumenti con la percentuale.
- «Prova senza»: il blocco esce, gli altri si ridispongono con una molla e in cima compare quanto risparmieresti in un anno.
  Si possono provare più abbonamenti insieme e rimetterli con un tocco. È solo una simulazione.

## 0.15.0 — 17 ottobre 2026 · abbonamenti

- Profilo → Abbonamenti e ricorrenti: in cima quanto costano gli abbonamenti in un anno (e al mese), poi ognuno con il suo
  monogramma, la ripetizione, quando si rinnova, come lo paghi e gli aumenti di prezzo dell'ultimo anno; sotto gli altri pagamenti fissi.
- Aggiungere un abbonamento: catalogo di 80 servizi (video, musica, cloud, app, giornali, giochi, sport, telefono, formazione)
  con ricerca istantanea e categorie, poi il modulo già compilato con il cursore sul prezzo. Monogrammi disegnati da noi,
  nessun logo di marchi. Nel calendario, scrivendo il nome di un abbonamento arrivano i servizi suggeriti.
- Come lo paghi (carta, conto, PayPal, Apple Pay, Google Pay, Satispay, contanti): solo un'etichetta, nessun collegamento alla banca.
- Storico dei prezzi: ogni cambio d'importo resta nell'evento; nel dettaglio il cambio e quanto costa in un anno.

## 0.14.0 — 17 ottobre 2026 · calendario 2.0

- In cima al mese, su una superficie in vetro: quanto resta a fine mese (previsione), la linea di quanto è già pagato,
  entrate, uscite, già pagato, da pagare, e cosa è in ritardo tra le scadenze che segui "finché non è fatto".
- Un colore per tipo nei giorni (pagamenti, entrate, risparmi e investimenti, promemoria) con la legenda; i giorni più
  pesanti del mese in rosso.
- Sotto il mese, la settimana del giorno scelto come timeline; la stessa timeline per le viste Giorno, Settimana e Agenda,
  con le voci che entrano una dopo l'altra.
- Come nel budget, un pagamento ricorrente conta come pagato dal suo giorno: non serve segnarlo.

## 0.13.0 — 17 ottobre 2026 · proposte dai movimenti

- Calendario → «Sembrano ricorrenti»: Quadriamo trova nei tuoi movimenti quello che torna ogni mese (bollette, abbonamenti,
  stipendio, paghetta, versamenti nel PAC) e lo propone, al massimo tre alla volta. «Aggiungi al calendario» apre il modulo
  già compilato; «No» la scarta per sempre. Niente si aggiunge senza di te.
- Solo regole, nessuna AI: stessa descrizione e categoria in almeno 3 mesi degli ultimi 6, una volta al mese, a circa un mese
  di distanza, con importi simili (identici per svago e cibo, così l'aperitivo non diventa una scadenza), l'ultima da non più
  di 45 giorni, e non già nel calendario.

## 0.12.0 — 17 ottobre 2026 · centro notifiche e collegamenti

- Profilo → Centro notifiche: le notifiche arrivate restano sul telefono (le ultime 100), con ricerca e filtri
  (tutte, da leggere, importanti, archiviate); per ognuna: apri, letta/da leggere, importante, archivia, elimina.
  Toccandola porta dove serve (scadenze al calendario, notizie alle Notizie). Il numero da leggere compare nel Profilo.
- Calendario: nuovi tipi «Versamento» (verso il fondo di emergenza o un obiettivo) e «PAC» (parte dalla cifra del piano in Investimenti).
  Segnare come fatto un versamento verso un obiettivo aggiunge la cifra all'obiettivo; annullare la toglie.
- Le scadenze degli obiettivi compaiono nel calendario con quanto manca, e una settimana prima arriva un promemoria.
- Cambiando tipo di evento, la categoria segue il tipo (se non l'avevi cambiata tu).

## 0.11.0 — 16 ottobre 2026 · promemoria e notifiche

- Promemoria su ogni evento del calendario: 30, 14, 7, 3, 1 giorno prima, il giorno stesso, qualche ora prima, a un orario preciso,
  e se vuoi ogni giorno finché non lo segni come fatto (al massimo una settimana).
- Profilo → Notifiche: categorie (scadenze, mattino, promemoria se dimentichi, notizie), orario preferito, ore di silenzio,
  giorni attivi e un tetto giornaliero (oltre, gli avvisi si uniscono in uno solo).
- Il permesso per le notifiche si chiede al primo promemoria, con una spiegazione prima; se lo neghi non si richiede più.
- Al server arrivano solo l'ora e il nome dell'evento: gli importi li aggiunge il telefono.
- Corretto: la notifica del mattino ora rispetta il suo interruttore.

## 0.10.0 — 16 ottobre 2026 · calendario finanziario

- Analisi → Calendario: giorno, settimana, mese e agenda, con quello che esce e quello che entra.
- Eventi di ogni tipo (affitto, bollette, rate, mutuo, abbonamenti, stipendio, dividendi, cedole, scadenze fiscali, promemoria)
  che si ripetono ogni mese, ogni 2, 3 o 6 mesi, ogni anno o come vuoi, con una fine (dopo N volte o in una data).
- I pagamenti ricorrenti sono ora eventi del calendario: stessi conti, nessun dato da reinserire. "Segna come fatto" su ogni scadenza.
- La Home mostra i pagamenti dei prossimi 30 giorni; toccando un pagamento ricorrente tra i movimenti si apre il suo evento.

## 0.9.0 — 16 ottobre 2026 · prima beta per i tester

- Configurazione per ambiente (sviluppo, produzione) senza toccare il codice.
- Versione e build visibili nell'app e salvate con statistiche, errori e feedback.
- Per i tester: segnalazioni con priorità, screenshot, video e diagnostica; "Segnala il problema" dalla schermata d'errore.
- Errori con gli ultimi passi; statistiche d'uso per sessione (solo con il consenso); pannelli Uso dell'app e Segnalazioni nell'admin.
- Aggiornamenti appena l'app torna in primo piano, con l'avviso della versione nuova.
- App per Android (APK) da installare senza Play Store; protezione dagli script iniettati (Content Security Policy).
- Home a widget personalizzabile, sfondi per sezione, barra di navigazione in vetro.
- Capitale con destinazioni e regole d'uso; consigli a regole.
- Notizie con categorie, filtri, ricerca, podcast e immagini.
- Area amministratore con ricerca globale (⌘K), scorciatoie ed elenco degli errori.
