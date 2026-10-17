# Novità di Quadriamo

Una voce per versione, dalla più recente. Il numero tra parentesi nell'app (es. 0.9.0 (146)) è la build:
cresce a ogni modifica pubblicata, così ogni segnalazione dei tester indica esattamente quale codice stavano usando.
Come si pubblica una nuova versione: docs/RELEASE.md.

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
