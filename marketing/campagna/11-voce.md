# La voce di Quadriamo — guida di lettura

Vale per tutti i voice-over della campagna: i 6 video già montati, in italiano e in inglese (voce sintetica, `make_reels.py`) e quelli da registrare
con una voce professionista (spot a pagamento, hero, demo). Gli script restano quelli di `01-reel.md`, `02-hero-e-demo.md`
e `03-spot.md`: cambia **come** si leggono.

## 1. Il carattere
Una persona competente, appassionata di tecnologia e di soldi, che spiega cose complesse con semplicità.
**Premium, moderna, sicura. Calda, mai fredda. Professionale, mai istituzionale.** Entusiasmo misurato.
Non vende un'app: racconta un'esperienza che migliora la giornata.

Riferimenti di tono: le voci dei video di presentazione di Apple, Google Pixel e Nothing; i film di lancio di Linear,
Arc, Notion e Stripe; la calma degli spot di Revolut e Airbnb. Ogni parola scelta, nessuna in più.

**Evitare**: tono robotico, monotono, da televendita, teatrale, troppo entusiasta; frasi incollate; accelerare negli elenchi;
il "sorriso finto" a fine frase; enfasi su ogni parola.

## 2. Il ritmo: progressivo
| Parte | Come | Velocità indicativa |
|---|---|---|
| **Gancio** (prima battuta) | energico, diretto, una domanda o un fatto | un filo più svelto |
| **Corpo** | disteso e chiaro, una idea per frase | normale |
| **Finale** (marchio e CTA) | deciso, più lento, l'ultima parola "atterra" | un filo più lento |

- **Pause naturali** tra le frasi. Nei copioni: `|` = pausa breve (un respiro), `||` = pausa lunga (lascia "atterrare" la parola).
- **Elenchi**: una pausa breve tra le voci, stessa velocità per tutte, l'ultima voce con l'intonazione che chiude.
- Le parole importanti respirano: una pausa breve **prima** di un numero, una pausa lunga **dopo** il nome «Quadriamo».

## 3. Intonazione ed enfasi
Variazione naturale, mai cantilena. L'enfasi è un leggero rallentamento e un appoggio sulla sillaba accentata, mai un
aumento di volume. **Una parola chiave per frase al massimo.**
Parole da valorizzare: **Quadriamo, oggi, controllo, semplicità, budget, risparmio, investimenti, organizzazione,
futuro, niente sorprese**, i **numeri** (36,97 €; +38%; 419,88 €).
*Non usiamo* «AI» né «libertà finanziaria»: non sono vere o non sono nel nostro modo di parlare (BRIEF §12).

## 4. Pronuncia
| Parola | Come |
|---|---|
| Quadriamo | qua-dri-**à**-mo, chiara, mai mangiata |
| DAZN | «da-zòn» (come in Italia) |
| Netflix, Spotify, iCloud | all'inglese, senza esagerare |
| PAC | «pac», una parola |
| 36,97 € | «trentasei euro e novantasette» (nei reel brevi: «trentasei e novantasette») |
| +38% | «più trentotto per cento» |
| 419,88 € | «quattrocentodiciannove euro» (arrotondare a voce va bene se il numero è a schermo) |

Dizione pulita, nessuna inflessione regionale marcata, nessuna "s" sibilante (de-esser in post).

## 5. Per tipo di video
| Tipo | Tono | Tempo | Pause |
|---|---|---|---|
| Reel / TikTok / Shorts | energico, rapido, elegante | ~165-175 parole/min | brevi |
| Hero | cinematografico, ispirato, raffinato | ~135-145 parole/min | lunghe, il silenzio fa parte della scena |
| Spot | incisivo, memorabile, ritmato sul montaggio | ~160 parole/min | sui tagli |
| Demo dell'app | chiaro, rassicurante, spiega | ~150 parole/min | dopo ogni azione mostrata |
| Educativo | semplice, autorevole, didattico | ~145 parole/min | prima del concetto chiave |

## 6. Tecnica (registrazione e consegna)
- Microfono a condensatore, stanza trattata (o un armadio pieno di vestiti), distanza 15-20 cm, filtro anti-pop.
- WAV 48 kHz / 24 bit, una battuta per file, **2-3 versioni** per battuta (una più calda, una più asciutta).
- Post: taglio sotto 80 Hz, un filo di calore, presenza leggera, de-esser, compressione morbida, **−14 LUFS integrati,
  picchi a −1,5 dBTP** per i social; −16 LUFS per YouTube orizzontale.
- La musica sotto la voce scende (ducking) di 7-8 dB mentre si parla e risale nelle pause.

## 7. Come «legge» la voce sintetica (voice.py) — le stesse regole valgono per chi registra
**La punteggiatura decide l'interpretazione.** Ogni frase (fino a `. ? ! ; : …`) si dice da sola, poi una pausa diversa:
| Segno | Pausa dopo (rispetto alla pausa di frase) | Intenzione |
|---|---|---|
| `,` | nessuna: la voce si appoggia e prosegue | continuità |
| `:` | 0,55 | annuncio: quello che segue è la risposta |
| `;` | 0,75 | stacco morbido |
| `.` | 1,0 | chiusura |
| `!` | 0,9, un filo più di volume | energia (raro) |
| `?` | 1,25, intonazione che sale di mezzo tono | curiosità: lascia pensare |
| `…` | 1,3 | sospensione prima della rivelazione |
| `\|` / `\|\|` | respiro breve / pausa lunga | dove la parola deve «atterrare» |

- **Ritmo alternato**: nel corpo le frasi alternano un passo più disteso e uno più svelto (mai la stessa velocità per 3 frasi).
- **Intonazione variabile**: domande in salita; frasi brevi affermative (≤ 3 parole) più lente e più basse (autorevolezza);
  il nome «Quadriamo.» deciso e basso; l'invito finale più energico e luminoso; le spiegazioni calme.
- **Respiri**: prima di una frase lunga (6+ parole) dopo una pausa vera, un respiro appena udibile. Mai una voce che non respira.
- **Enfasi solo su**: il beneficio, il problema, il numero, il vantaggio, la CTA. Tutto il resto è neutro.
- **Testo parlato, non scritto**: le frasi si riscrivono per l'orecchio prima di registrarle (frasi corte, il soggetto
  vicino al verbo, i numeri come si dicono: «più trentotto per cento», «quasi quattrocentoventi euro»).

## 8. La voce guida il video
Ogni scena dura quanto la sua battuta (+0,25 s prima, +0,45 s dopo); lo zoom sul dettaglio e la dissolvenza prima/dopo
partono quando la voce arriva alla frase che li nomina; il fruscio di transizione cade 0,2 s prima del taglio.

## 9. Versione inglese
Non una traduzione: un adattamento. Tono fintech premium (Monzo, Revolut, Apple), frasi ancora più corte, verbi attivi,
nessun idiomatismo forzato. Voce `af_heart` (Kokoro, americana neutra); schermate dell'app in inglese
(`shots-campaign/en-dark`). Euro con il simbolo davanti (€36.97), date all'inglese («October's over»).

## 10. Sottotitoli (italiano e inglese)
- Tempi presi dalla voce, frase per frase; un blocco = un'unità di senso (mai spezzato a caso). Una frase lunga si divide
  a una virgola o ai due punti; un pezzo che finisce con virgola resta col seguito se ci sta («Lo salvi, o lo condividi.»).
- Al massimo **2 righe**, ~40 caratteri per riga; Inter 600, 42 px, bianco caldo su una lastra scura arrotondata (87%),
  a 1440 px dall'alto (sopra la zona dei pulsanti di Instagram/TikTok); comparsa e uscita in 120 ms.
- Nei titoli cinetici il sottotitolo non si ripete se la frase è già scritta grande; nella scena finale non c'è.
- I sottotitoli sono impressi nel video (si leggono anche senza audio). Per ogni video c'è anche il file `.srt` con gli
  stessi blocchi: caricarlo dove è accettato (YouTube, LinkedIn, X, Facebook) per accessibilità e ricerca; su YouTube
  scegliere i sottotitoli caricati, non quelli automatici.

## 11. Copioni dei video già montati
I copioni (italiano e inglese, con i segni di pausa) sono in `marketing/make_reels.py` (REELS): sono la fonte unica.
Video: `out/video/<nome>.mp4` + `.srt` (italiano), `out/video/en/<nome>.mp4` + `.srt` (inglese).

## 12. Come leggere gli altri script (01-reel, 02-hero-e-demo, 03-spot)
Le battute della colonna «Voce» si leggono così:
1. Prima battuta = **gancio**; ultima (marchio) = **finale**; tutto il resto = **corpo**.
2. Ogni punto = pausa di frase; ogni virgola prima di un elenco o di un numero = `|`; dopo «Quadriamo.» sempre `||`.
3. Domande: intonazione che sale davvero, poi `||` (lascia pensare chi ascolta: «Indovina.»).
4. Parola chiave per riga (da sottolineare a voce):

| Script | Parola chiave | Tono |
|---|---|---|
| R02 numero del giorno | «oggi» | sicuro, didattico |
| R03 POV 15 del mese | «in tempo» | complice |
| R04 la bolletta | «Fatto.» | sollievo, leggero |
| R06 Netflix aumentato | «trentotto» | sorpresa misurata |
| R07 sei secondi | (solo suoni) | — |
| R08 gioco dei blocchi | «Decidi tu.» | giocoso, poi fermo |
| R09 prova gratuita | «in tempo» | pratico |
| R10 notizie | «cinquantasette» | calmo |
| R12 calendario 15 s | «quanto resta» | chiaro |
| R13 giorno più pesante | «il primo» | complice |
| R14 notifiche | «decidi tu» | rassicurante |
| R15 centro notifiche | «restano tutte qui» | rassicurante |
| R16 checklist auto | «una volta» | pratico |
| R17 fuori sede | «niente scansioni» | vicino, da amico |
| R19 piccole spese | il numero | sorpresa misurata |
| R20 condividi la ricevuta | (parlato del creator) | naturale |
| R22 fondo di emergenza | «tre mesi» | educativo, autorevole |
| R23 Erasmus | «va dritto nell'obiettivo» | storytelling, prima persona |
| R24 5 dettagli | i numeri «uno… cinque» | design, appassionato |
| R25 ovunque | «La stessa calma» | elegante |
| H02-H10 | l'ultima frase di ogni video | cinematografico, lento |
| S01-S10 (spot) | il claim | ritmato sul montaggio |
| D01-D10 (demo) | il nome dell'azione | chiaro, guida |

## 13. Rigenerare video e voci
`<python con kokoro-onnx> marketing/make_reels.py` (tutti, in italiano e in inglese) o con il nome di un video; `--lang it` o `--lang en` per una lingua sola. Voce maschile: `QUADRIAMO_VOICE=im_nicola`.
Stili, velocità e pause: `marketing/voice.py` (STYLES). Segni di pausa nelle battute: `|` e `||`.
