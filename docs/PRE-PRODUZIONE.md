# Checklist di pre-produzione · app per i tester

Stato al 17 ottobre 2026, versione 0.20.0. ✅ pronto · 🟡 pronto, manca un passo di Carlo · 🔧 da sviluppare · ⚠️ rischio

## 1. Ambienti e configurazione

- ✅ Ambienti sviluppo e produzione (`src/env.ts`, file `.env.<ambiente>`, variabili della GitHub Action). Cambiare ambiente o chiavi non tocca il codice.
- ✅ Feature flag per ambiente (`VITE_FLAGS`): oggi `tester`.
- ✅ **Decisione del 16 ottobre: un solo backend** finché chi usa l'app sono i tester. Gli strumenti per i tester (flag `tester`)
  sono accesi in produzione; i dati di ognuno restano nel suo account e passano così come sono al lancio pubblico.
- 🔧 Prima del lancio pubblico: un ambiente di prova separato (staging) con un suo progetto Supabase (docs/RELEASE.md).
- ✅ Segreti mai nell'app: chiavi private in Supabase (Edge Functions → Secrets), firma Android in `.keys.local/` e nei segreti di GitHub.

## 2. Backend reale

- ✅ Accesso, database con RLS, sincronizzazione, foto profilo (archivio privato), notifiche push, profilo, notizie, statistiche, segnalazioni, backup (copia JSON/CSV sul telefono + sincronizzazione).
- ✅ I dati di esempio si aprono solo su scelta dell'utente e non vengono mai sincronizzati, contati nelle statistiche o usati per le notifiche.
- ✅ Niente IA (scelta di Carlo): consigli a regole, e anche le proposte del calendario sono regole.

## 2b. Calendario, promemoria e notifiche (0.10.0 – 0.13.0)

- ✅ Calendario in Analisi (giorno, settimana, mese, agenda) con eventi di ogni tipo, ripetizioni e fine; i vecchi pagamenti
  ricorrenti sono diventati eventi senza cambiare i conti del budget.
- ✅ Promemoria per evento (giorni o ore prima, orario preciso, ogni giorno finché non è fatto) e preferenze in Profilo → Notifiche:
  categorie, orario, ore di silenzio, giorni attivi, tetto giornaliero. Email spenta finché non c'è il dominio.
- ✅ Permesso chiesto solo al primo promemoria, dopo una spiegazione; dopo un rifiuto non si richiede, si riattiva dal Profilo.
- ✅ Al server arrivano solo l'ora e il nome dell'evento (tabella `push_reminders`, cancellati 7 giorni dopo): gli importi li aggiunge il telefono.
  Invio ogni 10 minuti (cron + send-push "reminders"). Migrazione 0029 e send-push eseguiti in produzione (passo 21).
- ✅ Corretto: la notifica del mattino ora rispetta il suo interruttore.
- ✅ Centro notifiche (Profilo): le notifiche arrivate restano sul telefono (ultime 100), con ricerca, filtri e azioni.
- ✅ Versamenti verso un obiettivo o il fondo di emergenza, PAC dal piano in Investimenti, scadenze degli obiettivi nel calendario.
- ✅ Proposte "Sembrano ricorrenti" dai movimenti: nulla si aggiunge senza conferma.
- ✅ Informativa privacy aggiornata (17/10, italiano e inglese): promemoria con ora e nome dell'evento sul server (mai importi),
  cancellati entro 7 giorni; documenti senza scansioni; centro notifiche solo sul telefono.
- ⚠️ Centro notifiche e proposte scartate valgono per il singolo telefono (non si sincronizzano tra dispositivi).
- ⚠️ I promemoria arrivano solo con l'account e dopo che il telefono è stato online almeno una volta dopo l'ultima modifica
  (è lui a calcolarli e a mandarli al server). Su iPhone le notifiche funzionano solo con l'app aggiunta alla schermata Home.
- ⚠️ Le proposte dai movimenti sono provate su dati di esempio: con dati veri vanno osservate nelle prime settimane dei tester.

## 2c. Calendario 2.0, abbonamenti, documenti, «Adesso», ricevuta, widget (0.14.0 – 0.20.0)

- ✅ Calendario 2.0: riepilogo del mese (previsione di fine mese, già pagato, da pagare), un colore per tipo, giorni più pesanti, timeline.
  «In ritardo» solo per le scadenze seguite «finché non è fatto»: i pagamenti automatici contano come pagati dal loro giorno.
- ✅ Abbonamenti: catalogo di 80 servizi con monogrammi nostri (nessun logo di marchi), ricerca, metodo di pagamento (solo
  un'etichetta), storico dei prezzi con gli aumenti. Nessun prezzo di listino nel catalogo (cambiano spesso).
- ✅ Costo annuale (treemap) con «Prova senza»: è una simulazione, non cancella nulla.
- ✅ Documenti con scadenza, promemoria e rinnovi: solo nome, categoria e date.
- ✅ «Adesso» in Home: solo regole calcolate sul telefono; le anomalie guardano solo le spese variabili.
- ✅ Ricevuta del mese: immagine e PDF creati sul telefono, condivisione con il menu del sistema.
- ✅ Widget nuovi (mese in miniatura, abbonamenti, documenti) e preferiti in cima.
- ✅ Centro assistenza aggiornato nelle 4 lingue (11 domande nuove; risposta sulle rate corretta).
- ✅ Prestazioni della Home con «Adesso» rimisurate il 17/10 (telefono medio, CPU 4 volte più lenta): vedi sezione 9.
- ⚠️ Widget sulla schermata Home del telefono e del computer: non disponibili (servono le app native). La comunicazione non li promette.

## 3. Errori e diagnostica

- ✅ Errori dal telefono all'area admin con diario degli ultimi passi, ambiente, commit, sistema (pannello Errori).
- ✅ Rete di sicurezza su tutta l'app e su ogni sezione, con "Segnala il problema" dalla schermata d'errore.
- ✅ Migrazione 0024 eseguita in produzione (passo 18).
- ⚠️ Gli errori fuori da React prima del primo disegno (es. un modulo che non si carica) arrivano solo se la rete c'è.

## 4. Statistiche d'uso

- ✅ Per sessione, solo con il consenso: schermate, tempi, percorsi, uscite, funzioni più e meno usate, rallentamenti, errori (pannello Uso dell'app, totali solo da 5 dispositivi).
- ✅ Migrazione 0025 eseguita (passo 18).
- 🔧 Facoltativo: un "imbuto" dei primi giorni (configurazione → prima spesa → settimana 1) calcolato dalle sessioni.

## 5. Segnalazioni dei tester

- ✅ Problema o idea, priorità, descrizione, screenshot e video, diagnostica visibile prima dell'invio; dispositivo, versione, sistema, lingua, ora e ultimi passi inclusi.
- ✅ Area admin: segnalazioni ordinate per priorità, allegati, diario, stato (nuova, vista, risolta); allegati cancellati dopo 90 giorni.
- ✅ Migrazione 0026 eseguita (passo 18).
- 🟡 Mail a Carlo per ogni nuova segnalazione (funzione report-email + migrazione 0027, Resend gratuito): passo 19 della Configurazione.
- ⚠️ Allegati solo con l'accesso (scelta voluta contro gli abusi): chi prova senza account manda solo il testo.
- ⚠️ Entrando nell'admin con nome e codice gli allegati potrebbero non aprirsi (l'archivio di Supabase non vede il codice): in quel caso entrare con l'account.

## 6. Aggiornamenti

- ✅ L'app installata controlla la versione nuova ogni volta che torna in primo piano e ogni ora; si aggiorna al ritorno e mostra "Aggiornata alla versione …".
- ✅ Versione (package.json) + build (numero di commit) + commit, visibili nel Profilo e salvati con errori, statistiche e segnalazioni.
- ✅ CHANGELOG.md e docs/RELEASE.md.
- ✅ Prima di ogni pubblicazione: 211 test automatici (motore, database su Postgres, interfaccia) e 32 passi di prova dell'app vera
  nel browser (dal 17/10 anche abbonamenti, aumento di prezzo, costo annuale, documenti, «Adesso», ricevuta e centro assistenza).
- ✅ L'APK Android non va reinstallato per le novità: solo se cambiano nome, icona o indirizzo.
- ✅ Corretto: aprire l'app usa la pagina salvata con il codice della stessa versione (prima la cache di GitHub Pages poteva
  ripresentare la pagina vecchia per 10 minuti, e senza rete l'app si apriva solo finché quella cache durava). Ora si apre
  sempre anche offline; provato nei test che usano l'app.

## 7. Distribuzione

- ✅ iPhone: PWA dalla schermata Home (gratis). Notifiche e aggiornamenti dall'icona.
- ✅ **Android: APK** costruito e firmato dalla GitHub Action "Android" (chiave in `.keys.local/`, copia di sicurezza fatta da Carlo):
  https://github.com/carloludovicocapizzoto/quadriamo-app/releases/download/android/Quadriamo.apk
- 🟡 Prova dell'APK su un telefono Android vero (reinstallarlo dopo l'assetlinks per averlo a tutto schermo).
- ✅ App Android a tutto schermo: `assetlinks.json` provvisorio nel repository del CV, verificato da Google (`linked: true`). Col dominio si sposta (docs/RELEASE.md).
- 🔧 iOS nativo (TestFlight, App Store): richiede Apple Developer Program (99 $/anno), Xcode e un guscio nativo (Capacitor), con le notifiche via APNs.
- 🔧 Play Store: stesso APK in formato AAB, account sviluppatore Google (25 $ una volta), scheda dello store, informativa sui dati.

## 8. Sicurezza

- ✅ RLS su tutte le tabelle; le nuove (0024–0026) provate su Postgres con i ruoli veri: niente letture per chi non è amministratore, allegati solo nella propria cartella.
- ✅ Content Security Policy su app, admin e notizie: script solo dal sito, dati solo da Supabase e BCE. Provata: niente blocchi legittimi, script iniettati bloccati.
- ✅ HTTPS ovunque (GitHub Pages, Supabase). Dipendenze: nessuna vulnerabilità nota (npm audit).
- ✅ Sessione con rinnovo automatico del token (Supabase). Validazione degli input nell'app e vincoli nel database.
- ✅ Corretto: chi entra nell'admin con il codice ora legge gli errori (prima non poteva).
- ⚠️ Il token di accesso sta nella memoria del browser (normale per una web app; la CSP riduce il rischio). Con l'app nativa andrà nel portachiavi del sistema.
- ⚠️ I dati sul telefono non sono cifrati oltre alla protezione del dispositivo (come per ogni PWA).
- ✅ Controllo completo delle regole di accesso (0001–0029) su Postgres vero, ora nei test automatici (`tests/db.test.ts`): ogni modifica
  al database viene provata in CI. Tutte le tabelle hanno RLS; i dati di un utente li legge solo lui; le funzioni dell'area admin rifiutano
  chi non è amministratore.
- ✅ Trovato e corretto: nei budget comuni un membro poteva farsi creatore del budget o spostare un'altra persona (migrazione 0028).
- ✅ Migrazione 0028 eseguita in produzione (passo 20).
- ✅ Promemoria (0029): ognuno vede solo i suoi; li scrive solo il proprio telefono, al massimo 200 e nei prossimi 60 giorni, nomi tagliati a 60 caratteri.

## 9. Prestazioni (telefono medio: CPU 4 volte più lenta, rete 4G)

- ✅ Prima apertura: contenuto in 0,7 s, completo in 1,3 s (buono sotto 2,5 s); aperture successive 0,06 s dalla memoria del telefono.
- ✅ Home con i dati: 0,16 s, nessuna attesa lunga; sezioni caricate al primo uso (prima volta 155 ms in tutto, poi zero).
- ✅ Nessuna perdita: dopo 90 cambi di schermata nodi e gestori di eventi stabili.
- ✅ Rete e batteria: una richiesta di statistiche per sessione, notizie in memoria 20 minuti, sincronizzazione solo quando cambiano i dati.
- ✅ Solo la lingua in uso si scarica (le altre se la si cambia): alla prima apertura 218 KB invece di 343, stessa velocità; provato nei test che usano l'app (cambio lingua e apertura senza rete).
- ✅ 17/10, con 2 anni di movimenti (1.809) e 16 eventi: la Home si apre in 0,34 s (completa 0,52 s), il ritorno alla Home
  dura 0,08 s senza blocchi, una spesa aggiunta aggiorna la Home in 0,25 s. Prima della correzione: 0,70 s, 0,30 s e 0,43 s.
  La causa: ogni schermata ricalcolava tutti i mesi dall'inizio; ora i mesi stanno in una cache condivisa (`monthCache`)
  che vale finché movimenti e impostazioni non cambiano. Con pochi dati: apertura 0,16 s, ritorno 0,05 s.
- ⚠️ Una spesa aggiunta ricalcola comunque tutti i mesi (i saldi si riportano di mese in mese): con molti anni di dati
  potrebbe servire un calcolo incrementale. Oggi non necessario.
- ✅ Valutato e scartato: caricare Supabase solo quando serve. Dal 13/10 l'account è obbligatorio (tranne i dati di esempio), quindi a quasi
  tutti serve all'avvio per riprendere la sessione: per loro aggiungerebbe solo un'attesa.

## 10. Rischi residui

- ⚠️ GitHub Pages non è pensato per un servizio commerciale: spostare l'hosting (es. Cloudflare Pages, gratuito) prima di far pagare.
- ⚠️ Piano gratuito di Supabase: il progetto si sospende dopo 7 giorni senza attività e lo spazio è 1 GB (allegati compresi).
- ⚠️ Email di accesso dal mittente di Supabase (limiti di invio bassi): servono il dominio quadriamo.com e un SMTP (Resend) prima di molti utenti.
- ⚠️ Chiave di firma Android: se si perde, l'app non si aggiorna più. Tenerne una copia fuori dal Mac.

## 11. Prima del rilascio pubblico (consigliato)

1. Dominio quadriamo.com, hosting commerciale, SMTP con il dominio.
2. Supabase Pro (backup giornalieri, niente sospensione) quando ci sono utenti veri.
3. Testi legali definitivi (privacy con statistiche, segnalazioni, allegati e promemoria; termini; dati del titolare: oggi
   `public/owner.js` ha un indirizzo segnaposto).
4. Prezzo Pro e scheda per la partita IVA.
5. Guscio nativo per iOS (Capacitor) quando si apre l'Apple Developer Program.

## 12. Comunicazione

- ✅ Sito aggiornato in 4 lingue (titolo «Cosa conta oggi, per i tuoi soldi.», funzioni nuove, «Fatto bene», FAQ da 10, schermate nuove).
- ✅ Campagna rifatta sull'app 0.20 (`marketing/`, copia sul Desktop in «1 Da pubblicare/Campagna»), con le regole su cosa non dire
  (niente «AI», niente loghi dei servizi, niente widget fuori dall'app): `marketing/BRIEF.md` §12.
- 🔧 Newsletter ed email marketing: scritte, si inviano quando ci sono dominio e servizio di invio.

## Cosa deve fare Carlo, in ordine

1. ✅ Copia di sicurezza della chiave Android. ✅ Passi 18, 20 e 21 in produzione. ✅ Segreti Android e APK. ✅ assetlinks.json (repository del CV, provvisorio).
2. Installare e provare l'APK su un telefono Android (disinstallare la versione vecchia e reinstallare).
3. Provare un promemoria sull'iPhone: evento con promemoria tra qualche minuto → notifica → compare nel Centro notifiche.
4. Eliminare dal pannello di Supabase il progetto `quadriamo-beta` (vuoto) e la vecchia funzione `new-ingest`.
5. Facoltativo: mail per ogni segnalazione (passo 19, account gratuito Resend).
6. Dare un'email vera per il titolare del trattamento (`public/owner.js`), anche provvisoria in attesa del dominio.
7. Facoltativo: scegliere il titolo del sito (oggi «Cosa conta oggi, per i tuoi soldi.»; alternative in `marketing/campagna/10-landing.md`).
