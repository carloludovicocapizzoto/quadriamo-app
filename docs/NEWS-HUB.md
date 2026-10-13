# Notizie → Financial Knowledge Hub (progetto)

Obiettivo: ogni giorno pochi contenuti di qualità su finanza personale, economia, investimenti, mercati,
psicologia del denaro e ricerca economica, spiegati in modo chiaro. Qualità, non quantità.

## Regole che non cambiano
- **Mai ripubblicare**: per ogni contenuto mostriamo titolo, fonte, data e **un riassunto nostro** (1-2 frasi),
  e colleghiamo sempre all'originale. Il riassunto nasce da titolo e descrizione del feed, mai dal testo intero
  (rispetta copyright e paywall).
- **Solo canali che lo consentono**: feed RSS/Atom pubblici, feed dei canali YouTube, API ufficiali.
- **Immagini: solo quelle che la fonte mette nel suo feed** (decisione di Carlo, 13/10/2026), piccole a lato, caricate dal
  sito della fonte e mai salvate da noi. Se una fonte lo chiede si spengono con `images = false` sulla sua riga.
  Senza immagine la voce resta tipografica. Mai il logo della testata, mai i pixel di tracciamento.
- **Privacy**: la personalizzazione avviene sul telefono. Il server non sa cosa leggi.

## Architettura

```
 registro fonti (tabella)          ogni 2 ore (pg_cron)                       app
 ┌──────────────────┐     ┌─────────────────────────────────┐     ┌──────────────────────────┐
 │ news_sources     │ ──▶ │ Edge Function news-ingest        │ ──▶ │ legge news_clusters/items│
 │ tipo, lingua,    │     │ 1 scarica (ETag, timeout)        │     │ (sola lettura, pubblica) │
 │ paese, fiducia,  │     │ 2 normalizza e toglie i doppioni │     │ sezioni + filtri         │
 │ paywall, attiva  │     │ 3 arricchisce (regole o AI)      │     │ ordine personale calcolato│
 └──────────────────┘     │ 4 raggruppa lo stesso evento     │     │ sul telefono             │
          ▲               │ 5 punteggio di qualità           │     └──────────────────────────┘
          │               │ 6 salva, toglie > 30 giorni      │
   area admin: approva    └─────────────────────────────────┘
   fonti e creator proposti
```

Perché così:
- **Una tabella di fonti** invece di un elenco nel codice: una fonte nuova (o un formato nuovo: podcast,
  newsletter) è una riga, senza toccare l'app. Ogni fonte ha un tipo che dice come leggerla (`rss`, `youtube`, …):
  un formato nuovo è un lettore in più nella funzione, il resto della catena non cambia.
- **Elaborazione sul server, una volta sola**: riassunti, categorie e raggruppamenti si calcolano quando arriva il
  contenuto, non a ogni apertura dell'app. L'app legge dati già pronti: veloce, e i costi non crescono con gli utenti.
- **Lettura diretta dal database** (sola lettura, nessun dato personale): niente server da tenere acceso,
  la cache dell'app funziona anche offline.

## Dati

`news_sources`: id, nome, tipo (testata, indipendente, ricerca, banca centrale, organismo internazionale,
video, newsletter), feed, sito, lingua, paese, **fiducia 1-5** (qualità delle analisi, trasparenza, accuratezza,
reputazione: decisa a mano e rivista), paywall, categorie tipiche, attiva, stato dell'ultimo aggiornamento.

`news_items`: id (impronta dell'indirizzo canonico), fonte, titolo originale, link, data, lingua, formato
(articolo, ricerca, video), durata o tempo di lettura stimato, categorie, parole chiave, livello
(principiante / intermedio / avanzato), rilevanza per la finanza personale, segnale di clickbait,
riassunti nelle quattro lingue, evento.

`news_clusters`: lo stesso evento raccontato da più fonti (finestra di 48 ore): titolo nostro, riassunto,
elenco delle fonti con le loro prospettive, punteggio.

Punteggio = fiducia della fonte × freschezza × rilevanza × (1 − clickbait) × numero di fonti indipendenti.

## Categorie
Economia globale, Mercati, ETF, Azioni, Obbligazioni, Materie prime, Immobiliare, Finanza personale, Risparmio,
Budget, Previdenza, Psicologia finanziaria, Tasse, Tecnologia, AI e finanza, Startup.
**Criptovalute in una scheda separata**, mai nelle sezioni principali.

## Esperienza
In alto **Oggi**: 3-5 storie del giorno (più fonti sulla stessa notizia = una storia, «3 fonti»).
Poi sezioni brevi, ognuna con 3-5 voci e «Vedi tutto»: Da non perdere, Nuove ricerche (spiegate semplici),
Video consigliati, Approfondimenti, Per principianti, Finanza personale, ETF e investimenti, Trend globali.
Filtri per categoria in alto; livello (principiante/avanzato) nelle preferenze.
Ogni voce: fonte · tempo · livello · «a pagamento» se serve. Toccandola: un foglio con il riassunto, le altre
fonti sulla stessa notizia e «Apri l'articolo» (o il video) sul sito originale.
Niente like, commenti, conteggi di visualizzazioni: si legge, si scopre, si impara.

## Personalizzazione (sul telefono)
Ogni apertura aggiorna un piccolo profilo locale di interessi (categorie, formato, livello). L'ordine delle
sezioni e delle voci ne tiene conto, ma una parte resta sempre "fuori dalle abitudini" per non chiudersi in una
bolla. Si azzera dalle preferenze. Non lascia mai il dispositivo.

## Fonti di partenza (da verificare una per una all'implementazione)
- **Testate internazionali (titoli in RSS)**: Financial Times, The Economist, The Wall Street Journal, Barron's,
  CNBC, MarketWatch, Fortune, Morningstar, BBC Business, Le Monde Économie, Expansión.
  *Reuters e Bloomberg: nessun feed pubblico (solo licenze a pagamento).*
- **Italiane**: Il Sole 24 Ore, ANSA, Corriere, Repubblica, Money.it, Milano Finanza, Il Post (economia).
- **Indipendenti**: Calculated Risk, The Big Picture, A Wealth of Common Sense, Of Dollars and Data,
  Abnormal Returns, Morgan Housel (Collaborative Fund), Noahpinion, Bogleheads, Monevator.
- **Ricerca e istituzioni**: NBER (nuovi working paper), SSRN (reti di finanza), IMF Blog, World Bank Blogs,
  BIS, BCE (blog e bollettino), Banca d'Italia, OECD, Federal Reserve (FEDS Notes), VoxEU/CEPR, Bruegel.
- **Video (feed dei canali YouTube, senza chiavi)**: Il Punto Economico, Bruno Investe, Bernardo Mascellani,
  Giuseppe Castagna, Mr. RIP, The Plain Bagel, Ben Felix, Patrick Boyle, The Money Guy, Two Cents.

## Scoperta di fonti nuove (fase 3, scelta di Carlo: un mix)
Una volta a settimana il sistema cerca candidati: siti citati spesso dalle fonti affidabili, canali YouTube
collegati a quelli approvati, newsletter con feed. Poi:
- **entrano da soli** solo i candidati sopra soglie alte (citati da più fonti con fiducia 5, feed attivo da mesi,
  nessun segnale di clickbait), con fiducia 3 e il segno "scoperta automatica";
- **tutti gli altri** arrivano nell'area admin con esempi e statistiche: si approvano con un tocco e una fiducia.
Ogni fonte scoperta si può spegnere; se i suoi contenuti risultano spesso clickbait, si spegne da sola.

## Filtri di qualità
Doppioni (stesso indirizzo canonico, titoli quasi uguali), clickbait (punteggio sul titolo), fonti non approvate
(non entrano mai), titoli senza sostanza ("live", "minuto per minuto"), contenuti promozionali e sponsorizzati.
Le fake news si evitano soprattutto a monte: entrano solo fonti approvate, con fiducia dichiarata.

## Fase 1: com'è fatta (13/10/2026)
- Decisioni di Carlo: subito la fase 1; **niente AI** (al posto del riassunto, l'estratto che la fonte pubblica nel feed,
  indicato "Dalla fonte"); scoperta mista; immagini solo per i video.
- 44 fonti verificate una per una (feed vivi e aggiornati). Esclusi: Reuters e Bloomberg (nessun feed pubblico),
  Barron's, Morningstar, IMF, OECD, Les Echos (bloccano la lettura automatica), World Bank, Milano Finanza
  (feed spariti), Calculated Risk e il blog di Bogleheads (fermi).
- Regole provate su dati veri (`node tools/news/dry-run.ts`): circa 530 contenuti in una giornata; tolti i file di dati
  delle istituzioni, le frasi di servizio dei blog, l'elenco degli autori nei titoli; "ai" in italiano è una preposizione.
- Finestre: testate 7 giorni, indipendenti 14, video 21, ricerca e istituzioni 45 (escono di rado).

## Fase 1b: podcast, immagini e ricerca (13/10/2026)
- **Podcast** (13, nelle quattro lingue, verificati uno per uno): tipo di fonte `podcast`, letti dal feed RSS pubblico con
  copertina e durata. Si ascoltano sul sito del podcast (scelta di Carlo: link esterno, nessun lettore nell'app).
  Rational Reminder e The Money Guy Show restano come video: stessi episodi.
- **Ricerca per parole** in alto, senza maiuscole né accenti e anche sull'inizio di una parola (mutu → mutuo, mutui).
  Un argomento cercato si può **seguire**: diventa la sezione «I tuoi argomenti», subito dopo Oggi. Resta sul telefono.
- Filtri in alto anche per formato: Podcast, Video.
- La barra dei filtri e le sezioni compaiono quando la raccolta è attiva (passo 14 dell'area admin); prima l'app mostra
  i titoli delle testate come prima.
- Una funzione sola decide cosa entra (`_shared/news-item.ts`): la usano sia news-ingest sia lo script di prova.

## Fasi
1. **Fondamenta, senza costi**: registro fonti (circa 40), raccolta ogni 2 ore, doppioni, categorie con regole
   per lingua, archivio 30 giorni, nuove sezioni, personalizzazione sul telefono, scheda Cripto separata.
2. **Riassunti e intelligenza**: riassunti originali nelle 4 lingue, livello, raggruppamento degli eventi,
   clickbait, traduzione dei titoli. Con un modello AI (Claude Haiku) chiamato dal server una volta per contenuto.
3. **Scoperta**: candidati settimanali e pagina di approvazione nell'area admin, salute delle fonti.
