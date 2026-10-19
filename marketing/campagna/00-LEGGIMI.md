# Campagna Quadriamo — versione definitiva (app 0.20, 17/10/2026)

Sostituisce tutti i contenuti precedenti (campagna di lancio e campagna beta): niente schermate vecchie (Home a tessere
arancioni, "Opzioni", tab Movimenti in barra), niente funzioni superate. Fonte di verità: `marketing/BRIEF.md`.

## Cosa c'è
| File | Contenuto | Quanti |
|---|---|---|
| `01-reel.md` | Reel / TikTok / Shorts 15-30 s, con storyboard, testo a schermo, voce, animazioni, musica, suoni, durate, transizioni | 25 |
| `02-hero-e-demo.md` | Hero video 30-90 s stile keynote + demo cinematiche dell'app | 10 + 10 |
| `03-spot.md` | Spot ADV in versione 6 / 15 / 30 / 45 / 60 s per Meta, TikTok, Google, YouTube | 10 |
| `04-caroselli.md` | Caroselli Instagram da 5, 8 e 10 slide | 20 |
| `05-post-e-storie.md` | Post Instagram singoli e storie con adesivi | 30 + 30 |
| `06-x.md` | Thread per X: lancio, funzioni, mini storie | 20 |
| `07-linkedin.md` | Post LinkedIn: prodotto, startup, fintech, design | 15 |
| `08-newsletter-ed-email.md` | Newsletter (lancio, aggiornamenti, roadmap) ed email marketing | 10 + 15 |
| `09-campagne-funzioni.md` | Campagne dedicate alle funzioni nuove (concept, claim, piano, asset) | 10 |
| `10-landing.md` | La landing page riscritta: headline, sottotitolo, CTA, funzioni, prove, FAQ | 1 |
| `11-voce.md` | La voce di Quadriamo: carattere, ritmo, pause, enfasi, pronuncia, tecnica, copioni annotati | — |
| `../TESTI.md` | Didascalie pronte per i contenuti già prodotti in `out/` | — |

Già prodotti (in `marketing/out/`): carosello da 10, 8 post, 8 storie, 4 pin, post a meme, 5 reel e 1 hero con voce.
Tutto il resto qui è pronto per la produzione: si gira/si monta seguendo storyboard e regole qui sotto.

## Il sistema di produzione (vale per ogni contenuto)

### 1. Cosa mostriamo
- **Solo schermate vere** dell'app, con i **dati di esempio** (`marketing/shots-campaign/`, chiaro e scuro, telefono,
  tablet e computer). Per i video: registrazione dello schermo dell'app vera su iPhone (60 fps) o su Chrome in modalità
  dispositivo; mai mockup inventati.
- **Mai**: «AI», loghi dei servizi (solo i nostri monogrammi), widget sulla schermata Home del telefono, App Store,
  email di promemoria, numeri di utenti o recensioni inventate, l'area di amministrazione. (BRIEF §12)

### 2. Linguaggio visivo
- **Sfondi per sezione** come nell'app: Home blu notte/petrolio, Analisi indaco/viola, Investi smeraldo scuro,
  Notizie antracite/ghiaccio, Profilo grafite. Una luce diffusa in alto a destra, mai sfumature arcobaleno.
- **Vetro** solo sulle superfici protagoniste (riepilogo del mese, «Adesso», ricevuta, pulsante finale). Testo e righe piatti.
- **Tipografia**: Inter 600 per titoli e numeri, 400 per il testo; il numero è sempre il più grande sulla scena.
  Massimo 6 parole a schermo per volta. Mai più di due righe.
- **Colori di accento**: l'arancio Quadriamo `#C2410C` e l'arancio chiaro `#E8915F` per evidenziare (una cosa per scena).
- **Telefono**: cornice grafite sottile, nessuna ombra marcata; sul computer la finestra senza decorazioni.

### 3. Movimento (motion design)
- **Molle, non dissolvenze generiche**: ingressi con un leggero superamento (in After Effects: *Ease and Wizz* "Back Out",
  o in CapCut l'animazione "Rimbalzo" al 20%). Durata 400-650 ms.
- **Testo cinetico**: le parole salgono di 24-30 px e compaiono una dopo l'altra (110 ms di distanza).
- **Transizioni condivise**: l'elemento toccato diventa il titolo della schermata dopo (come nell'app). In montaggio:
  zoom sul punto toccato + taglio a 3 fotogrammi.
- **Dettagli**: zoom lento (1,0 → 1,35 in 2-3 s) sul numero o sulla riga importante; mai più di uno zoom per scena.
- **Cambi di sezione**: lo sfondo si evolve in 650 ms (blu → indaco → smeraldo), il contenuto entra dopo 80 ms.
- **Tocco**: un cerchio chiaro di 44 px che si stringe (feedback), più il suono "tap".
- **Ritmo**: un'idea per scena, scene da 1,5-3,5 s; nei primi 2 secondi una domanda o un numero.

### 4. Musica
- Tappeto **morbido, elettronico-ambientale, 90-105 BPM**, senza voce: pianoforte filtrato, synth caldi, basso rotondo.
  Riferimenti di atmosfera: keynote Apple, video di lancio di Linear e Arc, spot Revolut "calmi".
- Volume: −20 dB sotto la voce; sale di 3 dB sulla scena finale; chiusura con una nota lunga che sfuma in 1,2 s.
- Per i social: brani della libreria di Instagram/TikTok (licenza inclusa) o librerie con licenza commerciale
  (Artlist, Epidemic Sound, Musicbed). Mai brani commerciali senza licenza. Gli asset già prodotti usano un tappeto
  generato dal nostro script (nessun diritto).

### 5. Suoni (sound design)
| Nome | Quando | Indicazione |
|---|---|---|
| tap | un tocco sullo schermo | click morbido, breve (40 ms), filtrato sotto i 4 kHz |
| fruscio | transizione tra scene | rumore filtrato che sale e scende (450 ms), molto basso |
| molla | un elemento entra | "pop" grave e corto, quasi impercettibile |
| stampa | la ricevuta riga per riga | ticchettio leggero di stampante termica, 8-12 colpi |
| conferma | «Fatto», «Rinnovato», salvato | due note ascendenti (quinta), 180 ms |
| notifica | arriva un promemoria | campanella di vetro breve, mai il suono di sistema |
| blocchi | i blocchi della treemap si ridispongono | scivolamento di legno morbido, 300 ms |

### 6. Voce
- **Firma vocale maschile**: calda, piena, leggermente profonda, pulita (niente fiato udibile); **frasi corte**, pause vere; nessun tono da televendita. Guida completa: `11-voce.md`.
- Voce sintetica per le bozze (Kokoro, `voice.py`); per le versioni finali e gli spot pagati, una voce umana
  (maschile, timbro caldo e pieno, dizione impeccabile; mai l'imitazione di una persona reale) registrata in studio o da casa con microfono a condensatore.
- Sottotitoli sempre (il 70% guarda senza audio): Inter 600, bianco con contorno leggero, al centro in basso
  sopra la zona dei pulsanti dell'app social.

### 7. Montaggio (riferimenti trasformati in regole)
- **Apple / Stripe / Linear**: inquadrature pulite, spazio vuoto, un elemento alla volta, il prodotto come protagonista.
- **Revolut / Cash App**: ritmo, colore di sezione, numeri grandi che cambiano.
- **Arc / Raycast**: microinterazioni ravvicinate, il cursore o il dito come personaggio.
- **MKBHD / Hayden Bleasel / Design Ali**: inquadrature del telefono in mano su sfondo scuro, luce laterale morbida,
  macro dello schermo; spiegare "perché" un dettaglio è fatto così.
- **Ali Abdaal / Thomas Frank**: storytelling in prima persona, un problema reale, una soluzione, una lezione.
- **Daniel Schiffer**: transizioni fisiche (il telefono che ruota e diventa un'altra scena, match cut su un gesto).
- **Product Hunt / AppMasters / Canoopsy / Sam Beckman**: demo rapide, "5 cose che non sapevi", confronto prima/dopo.

### 8. Formati
| Piattaforma | Formato | Note |
|---|---|---|
| Reel / TikTok / Shorts | 1080x1920, 30 o 60 fps | zona sicura: 250 px sopra, 420 px sotto liberi |
| Post / caroselli Instagram | 1080x1350 | ultima slide sempre con la CTA |
| Storie | 1080x1920 | adesivi nella metà alta |
| YouTube hero | 3840x2160 o 1920x1080 | versione 16:9 e taglio 1:1 per LinkedIn |
| Meta / TikTok Ads | 9:16 e 4:5, 1:1 | primo fotogramma già "parlante" |
| Google Ads (YouTube) | 16:9, bumper 6 s | logo entro 5 s |
| X | 16:9 o 1:1, GIF ≤ 15 MB | prima immagine = gancio del thread |
| LinkedIn | 1:1 o 4:5, documenti PDF per i caroselli | |

### 9. CTA (scegliere una sola)
«Provala gratis, è in beta» · «Link in bio» · «Si installa in 30 secondi» · «Prova con i dati di esempio» ·
«Dimmi cosa ne pensi: ogni parere entra nella prossima versione».

### 10. Prima di pubblicare (controllo)
1. Ogni funzione mostrata esiste nella versione attuale? (BRIEF §4)
2. Nessuna delle cose del BRIEF §12? («AI», loghi, widget esterni, store…)
3. Schermate con i dati di esempio, nessun dato personale?
4. Il numero o la frase protagonista si legge in 1 secondo sul telefono?
5. Sottotitoli, testo alternativo, contrasto?
6. Musica con licenza?

### 11. Piano di uscita consigliato (4 settimane)
| Settimana | Tema | Contenuti principali |
|---|---|---|
| 1 | **Oggi** (Adesso, numero del giorno) | hero-01, reel 1-4, carosello C01, thread X01, LinkedIn L01, newsletter N01 |
| 2 | **Quello che non vedi** (abbonamenti, costo annuale) | reel 5-10, carosello C04-C06, campagna F03-F04, spot S03 |
| 3 | **Niente sorprese** (calendario, promemoria, documenti) | reel 11-17, carosello C07-C10, campagna F01-F02-F06 |
| 4 | **Il mese, in uno scontrino** (ricevuta) + **Parti da dove sei** (capitale) | reel 18-25, carosello C11-C20, campagna F05-F07, newsletter N04 |
Ogni giorno: 1 reel o post, 3-5 storie. Due volte a settimana: carosello. Il 1° del mese: la ricevuta (C11, R18).
