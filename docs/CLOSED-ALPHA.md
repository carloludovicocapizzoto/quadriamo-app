# Closed Alpha — prontezza, collaudi e istruzioni

Prima Closed Alpha per 5–10 tester, sull'ambiente Alpha separato dalla produzione storica (GitHub Pages / `main`).
Questo documento dice cosa è pronto, cosa manca e come si lavora con i tester.

> **Stato:** l'app NON è ancora pronta per tester esterni. Lo sarà solo dopo che i collaudi sul cloud (sezione 2)
> e la prova di recupero del backup risultano superati. Le prove in locale con backend simulato non bastano.

## 0. Gravità dei problemi

| Livello | Significato | Esempi |
|---|---|---|
| **Bloccante** | Perdita o mescolanza di dati, accesso impossibile, sincronizzazione ferma | Abbonamenti spariti, dati di A visibili a B, chiamate al gateway che falliscono |
| **Importante** | Funziona ma confonde o costringe a una via d'uscita | Messaggio sbagliato, conflitto con troppe domande, pulsante che non fa niente |
| **Rinviabile** | Rifinitura, non blocca né rischia dati | Testi, piccoli allineamenti, funzioni future |

## 1. Checklist di accettazione

| # | Requisito | Stato | Come si verifica |
|---|---|---|---|
| A1 | Nessuna perdita silenziosa tra due dispositivi (scenario del 21/10, conflitti, cancellazioni) | ✅ in locale · ⏳ cloud | `npm test` (REG), `npm run e2e:alpha` · cloud: S1–S6 |
| A2 | Eliminare una categoria non cancella niente senza avviso | ✅ in locale | `src/store/categories.test.ts`, `npm run e2e` (Categorie) |
| A3 | Ripristino di un backup: dice cosa sparisce, conserva i dati attuali | ✅ in locale | `runSync.test.ts` (REG) |
| A4 | Inoltro al gateway funzionante (Safari, Firefox, HTTP/1.1) | ✅ in locale · ⏳ cloud su iPhone | `alphaFetch.test.ts`, `npm run e2e:alpha` · cloud: T3 da iPhone |
| A5 | Accesso, invito, sessione scaduta, rete assente, cambio account A/B senza contaminazione | ✅ in locale · ⏳ cloud | `npm run e2e:alpha` · cloud: T1, T2, T6 |
| A6 | Offline, chiusura e riapertura, 429, 413, risposta persa | ✅ in locale · ⏳ cloud | `npm run e2e:alpha` · cloud: T4, T5, T8, T9 |
| A7 | Funzioni senza servizio nell'Alpha spente o spiegate (nessuna chiamata rifiutata dal gateway) | ✅ in locale | `npm run e2e:alpha` fallisce se l'app chiama una rotta rifiutata |
| A8 | Aggiornamento dell'app senza perdere i dati locali | ✅ in locale | `npm run e2e:alpha` (ultimo passo) |
| A9 | Telefoni 20:9 (412×919) e piccoli (375×667): niente sborda, «Salva» raggiungibile | ✅ in locale | giro manuale del 26/10 |
| A10 | Email per gli inviti (SMTP) attiva e verificata | ⏳ proprietario | invito di prova a un indirizzo autorizzato |
| A11 | Frontend Alpha pubblicato dal commit approvato | ⏳ proprietario | versione in Profilo → Versione |
| A12 | Backup cifrato e **recupero provato** su ambiente separato | ⏳ proprietario | T11 |
| A13 | Informativa privacy aggiornata per l'Alpha (cosa sta sul server, conservazione, contatto) | ⏳ Carlo | testo pubblicato |
| A14 | Canale di segnalazione concordato (a chi scrivono i tester) | ⏳ Carlo | sezione 4 |

L'Alpha è pronta per i tester esterni quando **tutte** le righe sono ✅ sul cloud.

## 2. Collaudi da eseguire sul cloud

Li esegue il proprietario dell'ambiente Alpha con sessioni sue; Claude prepara i passi e legge gli esiti ripuliti.
Solo dati inventati. Mai password, token, link d'invito, cookie o file HAR in chat, nei file o negli screenshot.

| ID | Prova | Prerequisito | Superata se | Copertura in locale |
|---|---|---|---|---|
| T0 | Inventario: regole di accesso, cron, consumi | — | nessuna regola inattesa, cron riuscito | — |
| T1 | Invito A e B | A10 | email arrivata, scelta password, due account distinti | e2e:alpha «Invito» |
| T2 | Accesso, rinnovo, uscita | T1 | sessioni separate; dopo l'uscita nessun dato visibile | e2e:alpha «Accesso», «Cambio di account» |
| T3 | Gateway con token reale, da Chrome **e da Safari su iPhone** | A11 | lettura e scrittura via `/api/rest/` rispondono 200 | `alphaFetch.test.ts` |
| T4/T5 | CAS: scritture concorrenti, risposta persa, riapertura | A11 | revisione +1 per ogni scrittura, nessun doppione | e2e:alpha, `runSync.test.ts` |
| REG | Scenario del 21/10 con due dispositivi | A11 | gli abbonamenti restano ovunque, nessuna domanda inutile | e2e:alpha «Copia vecchia» |
| T6 | Isolamento A/B | T2 | B non vede né modifica dati di A | e2e:alpha «Cambio di account» |
| T7 | Foto profilo: proprietario, anonimo, altro account | T2 | solo il proprietario legge e scrive la sua | — (Storage non simulato) |
| T8 | Offline su telefono vero, chiusura e riapertura | A11 | modifica conservata, una revisione nuova al ritorno della rete | e2e:alpha «Offline» |
| T9 | 429 e 413 (poche richieste, nessuno stress) | A11 | messaggio chiaro, modifica conservata, attesa rispettata | e2e:alpha «Errori del server» |
| T10 | Cron programmato | — | esecuzioni riuscite senza avvio a mano | — |
| T11 | Backup cifrato + recupero isolato | procedura approvata | conteggi, revisioni, ricevute, foto uguali; nuova scrittura e replay funzionano | — |

Copione passo-passo per due dispositivi: scenari S1–S8 (stesso formato: azione, cosa annotare, quando è superata).
Dopo un recupero da backup, i dispositivi che avevano una revisione più recente mostrano «La revisione del cloud è
incoerente»: è voluto, nessuna copia si sostituisce da sola. Va previsto nel piano di T11.

## 3. Istruzioni per i primi tester

1. **Apri il link dell'invito** arrivato per email e scegli una password (almeno 8 caratteri). Il link scade: se non
   funziona, chiedine uno nuovo a chi ti ha invitato.
2. **Installa l'app** sul telefono quando te lo propone (dal browser: «Aggiungi alla schermata Home»). Su iPhone usa Safari.
3. **Configura il budget** con i valori proposti: si cambiano dopo dal Profilo.
4. **Usala come faresti davvero, ma con cifre non reali o arrotondate** se preferisci: è una versione di prova.
5. **Più dispositivi:** accedi con lo stesso account su telefono e computer; le modifiche si uniscono. Se l'app ti chiede
   di scegliere tra due versioni di un dato, scegli con calma: l'altra versione resta nell'archivio di recupero.
6. **Senza rete** l'app funziona e salva sul dispositivo; quando torna la rete, sincronizza da sola.
7. **Non disponibili in questa Alpha:** Budget comune, notizie dal web, notifiche, statistiche d'uso, «Invita un amico».
   L'app lo dice dove serve.
8. **Non cancellare i dati del browser e non disinstallare l'app** se qualcosa non torna: prima segnalalo (sezione 4).

## 4. Segnalare un problema

Nell'app: **Profilo → Segnala un problema** (nell'Alpha la pagina spiega tutto). In breve:

- Scrivi **a chi ti ha invitato** (messaggio o email) cosa stavi facendo, cosa ti aspettavi, cosa è successo, l'ora e
  il dispositivo.
- Incolla i **dettagli tecnici** con il pulsante «Copia i dettagli tecnici»: versione, dispositivo, stato della
  sincronizzazione. Non contengono importi, descrizioni, email o identificativi.
- **Non mandare mai:** password, codici ricevuti via email, link d'invito, importi, nomi dei tuoi movimenti,
  screenshot con i tuoi dati.

Chi riceve la segnalazione la classifica (sezione 0) e la riporta nel tracciamento dei problemi, senza copiare dati
personali.

## 5. Esportare i dati e segnalare un errore di sincronizzazione

- **Profilo → Esporta e importa** mostra lo stato della sincronizzazione (revisione confermata, attese, errori) e permette di:
  - **Esportare la copia** dei tuoi dati (file JSON sul tuo dispositivo);
  - **Esportare tutte le copie di recupero** (la versione attuale e quelle conservate dopo conflitti o ripristini).
- In caso di errore di sincronizzazione: **non cancellare niente**, premi «Riprova la sincronizzazione», poi segnala
  con i dettagli tecnici. Le copie esportate contengono i tuoi dati: tienile sul tuo dispositivo e mandale **solo se
  te lo chiediamo**, per un canale privato.
- Ripristinare un backup con l'account sostituisce i dati anche sugli altri dispositivi: l'app dice prima quanti
  movimenti e scadenze spariranno e conserva i dati attuali nell'archivio di recupero.

## 6. Limiti noti e funzioni non disponibili

**Non disponibili nell'Alpha** (il gateway accetta solo sincronizzazione, profili e abbonamenti; elenco in `src/features.ts`):
Budget comune · notizie dal web (restano i consigli) · notifiche personali · segnalazioni e «Come ti trovi?» dall'app
(si usa la sezione 4) · statistiche d'uso anonime · ricerca anonima del profilo · invio automatico degli errori ·
eventi economici nella Home · «Invita un amico» · eliminazione dell'account in autonomia (serve una verifica assistita).

**Limiti della sincronizzazione:** documento fino a 1 MiB, fino a 200 salvataggi al giorno per account (oltre, l'app
aspetta e riprova da sola). Conflitti veri: l'app chiede il solo campo in conflitto (es. l'importo di un abbonamento);
lo storico dei prezzi segue la scelta. Rimane una scelta su tutto l'archivio solo se una copia manca o è illeggibile.

**Problemi aperti noti:**

| Gravità | Problema | Nota |
|---|---|---|
| Importante | Collaudi cloud non ancora eseguiti (sezione 2) | Gate del pilota |
| Importante | Due modifiche diverse dello stesso movimento (non scadenza) chiedono di scegliere tutto il movimento, non il campo | Raro; nessuna perdita silenziosa |
| Rinviabile | La pagina Notifiche descrive notifiche che nell'Alpha sono sospese (lo dice in cima) | Da semplificare quando tornano le notifiche |
| Rinviabile | La lingua delle email d'invito dipende dai modelli su Supabase | Da verificare in T1 |
| Rinviabile | Prove E2E con Chrome headless e protocollo DevTools, non Playwright | Nessuna dipendenza nuova; stessi due dispositivi isolati |

## 7. Prove automatiche

| Comando | Cosa prova |
|---|---|
| `npm test` | motore, store, unione CAS a tre vie (REG), categorie, inoltro al gateway, regole del database (PGlite), sicurezza del simulatore |
| `npm run e2e` | app senza server, 35 passi da utente (anche eliminazione di una categoria) |
| `npm run e2e:alpha` | app Alpha contro un backend simulato, due dispositivi + account B; fallisce se l'app chiama una rotta che il gateway rifiuta o se il simulatore finisce nella build |
| `npm run alpha:local` | apre l'Alpha locale (dopo `e2e:alpha`) su http://127.0.0.1:4192/app/ con utenti di prova inventati |

Il backend simulato (`tests/fake-alpha.mjs`) riproduce i contratti del codice (gateway, CAS v2, risposte 429/413), non
Supabase: un passo verde qui non sostituisce il collaudo della sezione 2. È solo per le prove: ascolta su 127.0.0.1,
serve file solo dalle cartelle dichiarate all'avvio (mai un percorso arrivato da una richiesta, niente `..` né
collegamenti simbolici verso fuori), i comandi `/__e2e/*` chiedono un codice generato a ogni avvio, e non entra mai
nella build dell'app (controllato da `e2e:alpha`). Funziona anche su Windows (Chrome nelle cartelle standard o `CHROME=`).
