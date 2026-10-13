# Quadriamo — contenuti per lanciare la beta

Immagini e video in `marketing/out/beta/` (copia in `~/Desktop/Quadriamo/Campagna app/Beta`).
Le schermate usano i **dati di esempio** dell'app. Link in bio: https://carloludovicocapizzoto.github.io/quadriamo-app/
Il reel ha la voce narrante (Sara, voce sintetica generata sul Mac). Se aggiungi una musica dalla libreria di Instagram o TikTok, tienila bassa sotto la voce.

**Il messaggio, in una riga:** Quadriamo non ti dice quanto hai speso, ti dice quanto puoi ancora spendere oggi.
Ogni contenuto porta su questo, poi su un motivo per fidarsi (metodo, previsione, slancio, privacy), poi la richiesta: provala.

---

## 1 · Oggi puoi spendere (`post-01-oggi.jpg`, `storia-01-oggi.jpg`)
Ogni mattina alle 7:30 una notifica: quanto puoi spendere oggi, per ogni parte del tuo stipendio.
Non quanto hai speso ieri. Quanto puoi ancora spendere adesso.

Il numero lo calcola il tuo telefono, con i tuoi dati: non passa da nessun server.
Sto cercando i primi 50 tester: è gratis, link in bio.

#finanzapersonale #budget #risparmio #stipendio #soldi

**Storia** — adesivo sondaggio: «Sai quanto puoi spendere oggi?» → Sì / Più o meno / No

## 2 · Il metodo (`post-02-metodo.jpg`)
Lo stipendio arriva e si divide da solo in quattro parti:
55% essenziali · 20% qualità della vita · 15% fondo di sicurezza · 10% investimenti.

Ogni euro ha un compito, e sai sempre quanto resta in ogni parte. Le percentuali sono un punto di partenza: le cambi quando vuoi.

Commenta «4» e ti mando il link della beta.

#regola503020 #educazionefinanziaria #gestionesoldi #risparmiare

**Storia** — adesivo domanda: «Come dividi lo stipendio oggi?»

## 3 · Previsione di fine mese (`post-03-previsione.jpg`)
A metà mese Quadriamo ti dice già dove arrivi: spese fatte, bollette in arrivo, il tuo ritmo di oggi.
Se rischi di sforare lo scopri il 15, non il 30.

Beta gratuita, link in bio.

#budgeting #finanzapersonale #fineMese #soldi

**Storia** — adesivo quiz: «Arrivi a fine mese con qualcosa da parte?» Sempre / A volte / Mai

## 4 · Slancio (`post-04-slancio.jpg`)
Il segreto per tenere un budget non è il foglio di calcolo perfetto: è aprirlo ogni giorno.
In Quadriamo ogni giorno in cui segni una spesa, la fiamma cresce da sola: non c'è niente da spuntare.

Quanti giorni di fila riesci a fare? Link in bio.

#abitudini #risparmio #budget #crescitapersonale

**Storia** — adesivo cursore emoji 🔥: «Quanto sei costante con le spese?»

## 5 · Privacy (`post-05-privacy.jpg`)
I tuoi soldi sono affari tuoi.
→ I tuoi dati li vedi solo tu, nel tuo account
→ Server nell'Unione europea, connessioni cifrate
→ Gli importi delle notifiche li calcola il tuo telefono
→ Niente pubblicità, niente vendita di dati
→ Esporti o cancelli tutto quando vuoi

#privacy #finanzapersonale #app

## 6 · Cerco 50 tester (`post-06-tester.jpg`, `storia-06-tester.jpg`)
Sto costruendo Quadriamo e cerco 50 persone che la provino davvero per un mese.
È gratis durante la beta, si installa dal browser in un minuto (iPhone, Android, Mac, Windows) e dentro c'è un pulsante per dirmi cosa non va.

Link in bio. Se conosci qualcuno che arriva sempre al 20 del mese senza soldi, mandaglielo.

**Storia** — adesivo link al sito + adesivo «Aggiungi il tuo» per far condividere.

## Reel (`reel-beta.mp4`, 24 secondi, con voce)
Didascalia: «L'app che ogni mattina ti dice quanto puoi spendere oggi. Cerco 50 tester, gratis: link in bio.»

La voce dice: «Ogni mattina, Quadriamo ti dice quanto puoi spendere oggi. Lo stipendio si divide da solo: prima l'affitto, poi quattro parti. E sai già come finisce il mese, prima di arrivarci. Un minuto al giorno, e lo slancio cresce. I tuoi soldi restano affari tuoi. È gratis durante la beta. Cerco cinquanta tester: il link è nella bio.»
#finanzapersonale #risparmiare #budgeting #appconsigliate #soldi

---

## Calendario (due settimane)
| Giorno | Contenuto | Dove |
|---|---|---|
| Lun 1 | Post 6 «Cerco 50 tester» + storia 6 con link | Instagram, Facebook, LinkedIn |
| Mar 2 | Storia 1 con sondaggio | Instagram |
| Mer 3 | Post 1 «Oggi puoi spendere» | Instagram, TikTok (reel) |
| Ven 5 | Reel | Instagram, TikTok, YouTube Shorts |
| Lun 8 | Post 2 «Il metodo» (commenta «4») | Instagram |
| Mer 10 | Post 3 «Previsione» + storia 3 quiz | Instagram |
| Ven 12 | Post 4 «Slancio» + storia 4 | Instagram, TikTok |
| Dom 14 | Post 5 «Privacy» + storia 6 di nuovo | Instagram |

Ogni settimana: rispondi a tutti i commenti e messaggi entro la giornata e chiedi a chi la prova di lasciare un feedback dall'app
(Opzioni → Invia un feedback). Nell'area amministratore guarda «Ritorno dopo 7 giorni»: è il numero che dice se la beta funziona.

## Rigenerare
1. `npm run dev` (server di sviluppo acceso)
2. `node marketing/shoot.mjs` → schermate nuove in `marketing/shots/` (dati di esempio)
3. `python3 marketing/make_beta.py` → post, storie e reel in `marketing/out/beta/`
