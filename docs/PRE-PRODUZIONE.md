# Checklist di pre-produzione · app per i tester

Stato al 16 ottobre 2026, versione 0.9.0. ✅ pronto · 🟡 pronto, manca un passo di Carlo · 🔧 da sviluppare · ⚠️ rischio

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
- ✅ Niente IA (scelta di Carlo): consigli a regole.

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
- ✅ L'APK Android non va reinstallato per le novità: solo se cambiano nome, icona o indirizzo.
- ✅ Corretto: aprire l'app usa la pagina salvata con il codice della stessa versione (prima la cache di GitHub Pages poteva
  ripresentare la pagina vecchia per 10 minuti, e senza rete l'app si apriva solo finché quella cache durava). Ora si apre
  sempre anche offline; provato nei test che usano l'app.

## 7. Distribuzione

- ✅ iPhone: PWA dalla schermata Home (gratis). Notifiche e aggiornamenti dall'icona.
- ✅ **Android: APK** costruito e firmato dalla GitHub Action "Android" (chiave in `.keys.local/`, copia di sicurezza fatta da Carlo):
  https://github.com/carloludovicocapizzoto/quadriamo-app/releases/download/android/Quadriamo.apk
- 🟡 Prova dell'APK su un telefono Android vero.
- 🟡 App Android a tutto schermo: serve il file `assetlinks.json` nel repository `carloludovicocapizzoto.github.io` (o sul dominio quadriamo.com). Senza, l'app funziona ma con la barra dell'indirizzo in alto.
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
- 🔧 Prima del rilascio: controllo completo delle policy di tutte le tabelle storiche (0002–0023) con lo stesso banco di prova su Postgres usato per 0024–0026.

## 9. Prestazioni (telefono medio: CPU 4 volte più lenta, rete 4G)

- ✅ Prima apertura: contenuto in 0,7 s, completo in 1,3 s (buono sotto 2,5 s); aperture successive 0,06 s dalla memoria del telefono.
- ✅ Home con i dati: 0,16 s, nessuna attesa lunga; sezioni caricate al primo uso (prima volta 155 ms in tutto, poi zero).
- ✅ Nessuna perdita: dopo 90 cambi di schermata nodi e gestori di eventi stabili.
- ✅ Rete e batteria: una richiesta di statistiche per sessione, notizie in memoria 20 minuti, sincronizzazione solo quando cambiano i dati.
- 🔧 Consigliato: caricare solo la lingua in uso (−40 KB alla prima apertura).
- 🔧 Consigliato: Supabase caricato solo quando serve, per chi non ha un account (−55 KB).

## 10. Rischi residui

- ⚠️ GitHub Pages non è pensato per un servizio commerciale: spostare l'hosting (es. Cloudflare Pages, gratuito) prima di far pagare.
- ⚠️ Piano gratuito di Supabase: il progetto si sospende dopo 7 giorni senza attività e lo spazio è 1 GB (allegati compresi).
- ⚠️ Email di accesso dal mittente di Supabase (limiti di invio bassi): servono il dominio quadriamo.com e un SMTP (Resend) prima di molti utenti.
- ⚠️ Chiave di firma Android: se si perde, l'app non si aggiorna più. Tenerne una copia fuori dal Mac.

## 11. Prima del rilascio pubblico (consigliato)

1. Dominio quadriamo.com, hosting commerciale, SMTP con il dominio.
2. Supabase Pro (backup giornalieri, niente sospensione) quando ci sono utenti veri.
3. Testi legali definitivi (privacy con statistiche, segnalazioni e allegati; termini; dati del titolare).
4. Prezzo Pro e scheda per la partita IVA.
5. Guscio nativo per iOS (Capacitor) quando si apre l'Apple Developer Program.
6. Le due ottimizzazioni del punto 9 e il controllo delle policy storiche del punto 8.

## Cosa deve fare Carlo, in ordine

1. ✅ Copia di sicurezza della chiave Android. ✅ Passo 18 in produzione. ✅ Segreti Android e primo APK.
2. Facoltativo: repository `carloludovicocapizzoto.github.io` con `.well-known/assetlinks.json` per l'app a tutto schermo.
3. Installare e provare l'APK su un telefono Android.
4. Eliminare dal pannello di Supabase il progetto `quadriamo-beta` (creato e poi non usato, vuoto).
