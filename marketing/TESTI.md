# Campagna social dell'app Quadriamo (beta) — testi pronti

Immagini e video in `marketing/out/`. Le schermate usano i dati di esempio dell'app.
Link da mettere in bio: https://carloludovicocapizzoto.github.io/quadriamo-app/ (quando ci sarà: quadriamo.com).
I reel hanno la voce narrante (Sara, voce sintetica generata sul Mac con Kokoro: niente diritti da pagare). Se aggiungi una musica dalla libreria di Instagram/TikTok, tienila bassa sotto la voce.

## Instagram — carosello (7 immagini, `out/instagram/`)
I tuoi soldi, in quattro. 🟧🟧🟧⬜

Quadriamo divide le entrate in 4 parti con la regola 55-20-15-10 e ti dice ogni giorno quanto puoi ancora spendere.
→ Una spesa in 5 secondi, o importi l’estratto conto
→ Il tuo mese in un grafico
→ I tuoi dati restano tuoi: server nell’UE, niente pubblicità

È gratis durante la beta e si installa dal browser su iPhone, Android, Mac e Windows. Link in bio.
Provala e dimmi cosa ne pensi: ogni feedback finisce dritto nella prossima versione.

#budget #risparmio #finanzapersonale #educazionefinanziaria #soldi #gestionesoldi #regola503020 #stipendio #app #beta

## Storie (`out/stories/`, 3 in sequenza)
1. «I tuoi soldi, in quattro.» — adesivo sondaggio: «Sai quanto puoi spendere oggi?» Sì / No
2. «Quanto puoi ancora spendere oggi?» — adesivo domanda: «Come gestisci lo stipendio?»
3. «Gratis durante la beta» — adesivo link al sito

## Reel / TikTok / Shorts (`out/video/`)
**reel-01-quadriamo.mp4** (16 s, con voce) — didascalia: «L’app che ti dice quanto puoi spendere oggi, senza fogli di calcolo. Gratis in beta, link in bio.»
**reel-02-metodo.mp4** (16 s, con voce) — didascalia: «55-20-15-10: il metodo per far durare lo stipendio fino a fine mese. Lo fa l’app per te.»
Hashtag: #finanzapersonale #risparmiare #budgeting #soldi #appconsigliate

## Pinterest (`out/pinterest/`, 1000x1500)
1. **Il metodo 55-20-15-10 per gestire lo stipendio** — Essenziali, qualità della vita, fondo di sicurezza e investimenti: ogni euro ha un compito. App gratuita in beta.
2. **Sai sempre quanto puoi spendere oggi** — Un numero al giorno per ogni parte del budget, con le bollette già tenute da parte.
3. **Registra una spesa in 5 secondi** — Importo, categoria, fatto. Oppure importa l’estratto conto della banca.
Link di ogni pin: il sito.

## Calendario
Il calendario del primo mese (date, formati, stato) è nel documento «Quadriamo — Calendario contenuti, primo mese».

## Rigenerare
`python3 marketing/make_campaign.py` (Pillow + ffmpeg). Per nuove schermate: app con i dati di esempio, telefono 375x812, in `marketing/shots/`.
