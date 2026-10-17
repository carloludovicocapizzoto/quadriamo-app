# Testi pronti per i contenuti già prodotti (app 0.20 · 17/10/2026)

Sostituisce i testi della campagna di lancio e della beta. Immagini e video in `marketing/out/` (copia sul Desktop in
`Quadriamo/1 Da pubblicare/Campagna`). Le schermate usano **i dati di esempio dell'app**, mai dati reali.
Link da mettere in bio: https://carloludovicocapizzoto.github.io/quadriamo-app/ (quando ci sarà: quadriamo.com).
Regole su cosa dire: `BRIEF.md`, sezione 12 (niente «AI», niente loghi dei servizi, niente widget fuori dall'app).
Il piano completo della campagna (reel, hero, spot, caroselli, thread, LinkedIn, newsletter…) è in `marketing/campagna/`.

Hashtag di base (sceglierne 5-8): #finanzapersonale #educazionefinanziaria #budget #risparmiare #soldi #fuorisede
#studenti #abbonamenti #app #productdesign

---

## Carosello «Quadriamo, adesso» — `out/carosello/` (10 slide)
**Didascalia**
Cosa devo sapere oggi, per i miei soldi?

Quadriamo risponde ogni mattina: quanto puoi spendere oggi e, sotto, solo quello che conta.
→ Il calendario del mese: già pagato, da pagare, quanto resta
→ Promemoria discreti per bollette, affitto, documenti
→ Tutti gli abbonamenti, con gli aumenti e il costo di un anno
→ La ricevuta del mese, da condividere
→ I risparmi che hai già, ognuno con la sua regola

Gratis durante la beta. Si installa dal browser su iPhone, Android e computer. Link in bio.

**Testo alternativo (accessibilità)**: schermate dell'app Quadriamo con dati di esempio: Home, calendario, notifiche,
abbonamenti, costo annuale a blocchi, ricevuta del mese, documenti, capitale.

## Post singoli — `out/post/`
| File | Didascalia |
|---|---|
| 01-adesso | Cosa devo sapere oggi? Il numero del giorno e, sotto, quello che conta. Nient'altro. Gratis in beta, link in bio. |
| 02-calendario | Niente sorprese a fine mese. Il calendario dei tuoi soldi: già pagato, da pagare e quanto resta, giorno per giorno. |
| 03-aumenti | Netflix è aumentato del 38%. Te ne accorgi solo se qualcuno te lo dice. Quadriamo te lo dice. |
| 04-costo-annuale | Togli un blocco, guarda quanto risparmieresti. Senza DAZN: 419,88 € l'anno. È solo una prova: decidi tu. |
| 05-ricevuta | Il tuo ottobre, stampato. Ogni mese una ricevuta: dove sono andati i soldi, il confronto col mese prima, qualche curiosità. |
| 06-documenti | La patente scade tra 22 giorni. Meglio saperlo adesso che al controllo. Solo nome e date, nessuna scansione. |
| 07-capitale | Quanto dei tuoi risparmi puoi davvero toccare? Protetto, utilizzabile, da far crescere: il budget parte dalla tua situazione reale. |
| 08-ovunque | Telefono, tablet, computer. La stessa calma su ogni schermo. Si installa dal browser, in 30 secondi. |

## Post a meme «Giorno 1 / 12 / 19 / 27» — `out/meme/` (2 slide)
**Didascalia**
Il ciclo dello stipendio, in quattro giorni. 😅
Poi c'è la versione con Quadriamo (scorri).

Ogni mattina sai quanto puoi spendere, gli abbonamenti non ti sorprendono e a fine mese qualcosa avanza.
Gratis durante la beta, link in bio.

#fuorisede #stipendio #finemese #meme #budget #soldi
**Nota**: le illustrazioni della slide 1 si possono sostituire con foto tue o con licenza libera (Unsplash, Pexels):
mettile in `marketing/meme/foto/1.jpg`…`4.jpg` e rigenera. Mai fotogrammi di film o foto di campagne altrui.

## Storie — `out/storie/` (8, in sequenza o da sole)
| File | Adesivo consigliato |
|---|---|
| 01-sondaggio | Sondaggio «A che punto sei con il mese?» → Tranquillo / Al limite / Al verde |
| 02-adesso | Domanda «Qual è la prima cosa che controlli la mattina?» |
| 03-calendario | Quiz «Quale giorno è il più pesante?» (risposta: il 1°, l'affitto) |
| 04-abbonamenti | Slider «Quanti abbonamenti paghi?» |
| 05-costo-annuale | Domanda «Quanto pensi di spendere in un anno?» → nella storia dopo la risposta: 1.273,18 € (dati di esempio) |
| 06-ricevuta | Sondaggio «La condivideresti?» Sì / Solo agli amici |
| 07-documenti | Conto alla rovescia / Domanda «Sai quando scade la tua carta d'identità?» |
| 08-provala | Link al sito |

## Pinterest — `out/pinterest/` (link di ogni pin: il sito)
1. **Il calendario dei tuoi soldi** — Cosa hai pagato, cosa devi pagare e quanto ti resta a fine mese, in una pagina.
2. **Quanto ti costano gli abbonamenti in un anno?** — Ogni blocco è grande quanto un abbonamento costa in un anno.
3. **La ricevuta del mese** — Il riepilogo del mese come uno scontrino: categorie, confronti, curiosità.
4. **Documenti con le scadenze** — Carta d'identità, patente, assicurazioni: un promemoria prima che scadano.

## Reel con la voce narrante — `out/video/`
La voce è sintetica (Kokoro, generata sul Mac: nessun diritto da pagare). Sotto c'è un tappeto musicale morbido
generato dallo script e un fruscio sulle transizioni: si possono sostituire con un brano della libreria di Instagram/TikTok,
tenendolo a circa −20 dB sotto la voce.

| File | Durata | Didascalia |
|---|---|---|
| reel-01-adesso | ~23 s | Cosa devo sapere oggi? Un numero, e quello che conta. Il resto, quando vuoi. |
| reel-02-costo-annuale | ~27 s | Indovina quanto paghi di abbonamenti in un anno. Poi prova a toglierne uno. |
| reel-03-ricevuta | ~18 s | Ottobre è finito. Ecco lo scontrino. 🧾 |
| reel-04-niente-sorprese | ~23 s | La carta d'identità scade il giorno prima del volo? Non più. |
| reel-05-parti-da-dove-sei | ~17 s | Hai dei risparmi. Quanto puoi davvero toccare? |
| hero-01-quadriamo-adesso | ~40 s | Quadriamo, adesso. I tuoi soldi, in quattro. |

## Rigenerare
1. App con i dati di esempio accesa (`npm run dev`), poi `THEME=dark node marketing/shoot-campaign.mjs` e `THEME=light …`
2. `<python con Pillow> marketing/make_campaign.py` · `marketing/make_meme.py`
3. `<python con Pillow, numpy, kokoro-onnx, soundfile> marketing/make_reels.py` (un reel: aggiungi il nome)
