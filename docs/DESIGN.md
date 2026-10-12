# Quadriamo — progetto dell'interfaccia e design system

Ottobre 2026. Riferimenti: Apple Human Interface Guidelines, Material Design 3, e come esempio di "app da tasca" Duolingo
(barra in alto con i contatori, barra in basso, pannelli dal basso, missioni e traguardi). La logica dell'app non cambia:
cambiano struttura, gerarchia e componenti. Codice: `src/app-shell.css` (design system), `src/ui/shell`, `src/ui/home`,
`src/ui/screens`, `src/ui/kit`.

---

## 1. Analisi della versione precedente

| Problema | Perché è un problema |
|---|---|
| 6 schede in basso (Home, Mese, Movimenti, Anno, Investi, Opzioni) | Oltre 5 voci le etichette si tagliano e nessuna è più importante delle altre. HIG e Material consigliano 3–5. |
| Il pulsante + galleggiava sopra il contenuto e solo in alcune pagine | L'azione più frequente (segnare una spesa) cambiava posto e a volte spariva. |
| Home fatta solo di widget uguali, uno sotto l'altro | Nessuna gerarchia: il numero più utile ("quanto posso spendere oggi") aveva lo stesso peso di un elenco di categorie. |
| Lo slancio e il numero del giorno erano dentro le pagine | Le informazioni "di stato" devono essere sempre visibili, come i contatori in cima a Duolingo. |
| Mese, Anno e Investimenti erano tre schede separate | Sono tre viste della stessa cosa (analisi): occupavano metà della barra. |
| "Opzioni" era una pagina lunghissima di card | Per cambiare la lingua si scorrevano dieci sezioni. Le app vere usano un elenco di voci → pagina dedicata. |
| Emoji e simboli di testo (✓ ⚠ 🔔 → ‹ ›) | Si vedono diversi su ogni telefono e danno l'aria di prototipo. |
| Il modulo "Nuovo movimento" era un modulo web | Campi tutti uguali, categorie come lunga fila di pillole, tre pulsanti in basso. |
| Nessuno stato "di gioco" | Niente che premiasse l'abitudine quotidiana, che è ciò che fa funzionare un budget. |

## 2. Nuova architettura

```
┌──────────────── Barra in alto (fissa) ────────────────┐
│ [logo]                     🔥 12   (€) 56,34   (avatar)│  ← tocchi → pannelli dal basso
└────────────────────────────────────────────────────────┘
   Home │ Movimenti │  ( + )  │ Analisi │ Profilo          ← barra in basso (fissa)
```

- **Home** — cosa fare oggi.
- **Movimenti** — l'elenco del mese e i movimenti importati da confermare (pallino rosso sulla scheda).
- **+** — sempre al centro, sempre uguale: apre "Nuovo movimento".
- **Analisi** — Mese · Anno · Investimenti come schede in alto (segmented control).
- **Profilo** — chi sei, slancio, traguardi, e tutte le impostazioni come elenco.

### Regola dei 5 secondi
Ogni schermata ha **un solo protagonista**: Home → il numero del giorno; Movimenti → l'elenco; Analisi → la previsione o il
grafico; Profilo → lo slancio; Nuovo movimento → l'importo.

## 3. Schermate (wireframe testuali)

### Home
```
┌──────────────────────────────────────┐
│ ╔══════════════════════════════════╗ │  1. Numero del giorno (protagonista)
│ ║ OGGI PUOI SPENDERE               ║ │     gradiente arancio, cifra in serif grande
│ ║ 56,34 €                          ║ │     che sale all'apertura
│ ║ [Essenziali 18,13] [Qualità 38,21]║ │
│ ║ ▓▓▓▓▓▓░░░░░░  Giorno 12 di 31    ║ │
│ ╚══════════════════════════════════╝ │
│  (+)      (↓)       (✓)       (⇪)    │  2. Scorciatoie: Spesa · Entrata · Niente spese · Importa
│ Le tue quattro parti                 │  3. Quattro tessere 2×2 con anello di avanzamento
│ ┌──────────┐ ┌──────────┐            │     tocco → pannello con dettaglio e ultime spese
│ │Essenziali│ │Qualità   │            │
│ │369,65 € ◔│ │764,10 € ○│            │
│ └──────────┘ └──────────┘  …         │
│ Missioni di oggi              2/3    │  4. Missioni del giorno con barra di avanzamento
│ ✓ Segna le spese di oggi  ▓▓▓▓▓▓     │
│ ○ Dai un'occhiata alla previsione    │
│ Attività            Tutti i mov. ›   │  5. Ultime attività raggruppate per giorno
│ OGGI · Supermarket          −50,70 € │
│ I tuoi widget              Modifica  │  6. Widget scelti dall'utente (previsione, andamento…)
└──────────────────────────────────────┘
```
Tolto: titolo "Il tuo riepilogo", card "Rimasto questo mese" e "Ultimi movimenti" doppie (ora sono le tessere e l'attività).
Aggiunto: scorciatoie, missioni, tessere toccabili, pannelli di dettaglio.

### Movimenti
```
Movimenti                    (titolo grande)
‹   Ottobre 2026   ›
[Da confermare (5)]          ← solo se ci sono importati
[Elenco: avatar colorato · descrizione · data · categoria · importo]
```
Righe da 56 px con avatar della parte: si legge il colore prima del testo.

### Nuovo movimento (pannello dal basso)
```
 ✕           Nuovo movimento
[ Spese | Entrate | Risparmi ]        ← il tipo filtra le categorie
            0,00  (EUR ▾)             ← protagonista, tastiera numerica
CATEGORIA
[C][S][T][S]  tessere 4 per riga, colore della parte
[M][S][R][A]
┌ Descrizione        es. Supermercato ┐
│ Data       (Oggi)(Ieri) 12/10/2026  │  ← righe in stile impostazioni iOS
└ Pagato da          Parte automatica ┘
[              Salva               ]   ← un solo pulsante primario, fisso in basso
               Elimina                 ← solo in modifica, come testo rosso
```

### Analisi
```
Analisi
[ Mese | Anno | Investimenti ]   ← la pillola bianca scorre sotto la scelta
Mese: ‹ mese › · Previsione di fine mese · ciambella delle parti · spese giorno per giorno · categorie
Anno: ‹ anno › · Andamento 6 mesi · Categorie che crescono · riepilogo · mese per mese
Investimenti: (Pro) portafoglio, PAC, conti deposito
```

### Profilo
```
(avatar)  Nome / Ospite · email · [PRO]
[ Accedi o crea un account ]           ← solo senza account
┌ 🔥 12 Slancio ┐┌ ★ 12 Record ┐┌ ✓ 12 Giorni attivi ┐
Calendario del mese (giorni di fila uniti come una striscia)
Traguardi 5/8   [medaglie: oro se sbloccate, anello di avanzamento se no]
Impostazioni (elenco → pagina con "‹ Indietro")
  Il tuo piano · Account e sincronizzazione · Budget, regola e categorie · Spese ricorrenti
  Regole di smistamento · Budget comune · Beta: invita e feedback · Lingua · Dati e backup
```

### Pannelli della barra in alto
- **🔥 Slancio** → fiamma grande, "12 giorni di fila", calendario, slancio/record/giorni attivi.
- **(€) Oggi** → numero del giorno e dettaglio per parte.

## 4. Flussi principali
1. **Segnare una spesa (≤ 5 s):** + → importo → tessera categoria → Salva. La data è oggi, la parte è automatica.
2. **Giornata senza spese:** Home → "Niente spese" (o la missione): lo slancio continua.
3. **Estratto conto:** Home → Importa → scegli il file → Movimenti → conferma (singolo o "Conferma tutti").
4. **Capire il mese:** barra in basso → Analisi → Mese (previsione in cima).
5. **Cambiare un'impostazione:** Profilo → voce → pagina dedicata → ‹ Indietro.
6. **Primo avvio:** benvenuto → installazione guidata (per browser) → accesso o "continua senza account" → configurazione a passi (notifiche, stipendio, regola…).

## 5. Stati
| Stato | Come si presenta |
|---|---|
| **Vuoto** | Home senza stipendio: il riquadro arancio diventa invito "Registra lo stipendio" con pulsante bianco. Attività vuota: frase centrata. Traguardi bloccati: lucchetto + anello di avanzamento. |
| **Caricamento** | Splash con il logo; numeri che salgono da 0; anelli e barre che si riempiono (niente spinner nelle pagine). |
| **Successo** | Missione completata: icona verde con "pop". Slancio che cresce: fiamma in primo piano; ai traguardi (3, 7, 14, 30… giorni) pannello più grande. Pagamento Pro: messaggio "Benvenuto in Pro". |
| **Errore** | Messaggio sotto il campo o in fondo al modulo, in rosso con icona di avviso; mai solo il colore. Rete assente: pallino di sincronizzazione e nuovo tentativo automatico. |
| **Bloccato (Pro)** | Card centrata: icona, badge PRO, titolo, una frase, "Scopri Pro ›" → Profilo › Il tuo piano. |

## 6. Design system

### Colori
| Ruolo | Chiaro | Scuro |
|---|---|---|
| Sfondo `--bg` | #FAF7F2 | #14171B |
| Superficie `--surface` | #FFFDF9 | #1F2328 |
| Testo `--text` | #1F2328 | #F1ECE4 |
| Testo secondario `--muted` | #5B6068 | #B5B0A8 |
| Bordo `--line` | #E6DFD3 | #2E333A |
| Primario `--accent` | #C2410C (gradiente con #E0884F) | #F07A42 |
| Successo `--good` / Errore `--bad` | #15803D / #B42318 | #4ADE80 / #F87171 |
| Le quattro parti `--b1…--b4` | #C2410C · #E89A6C · #E9C9A6 · #8A8F98 | |
| Medaglie `--gold` | #E3A008 | |

Uso: l'arancio solo per azioni e per lo stato "attivo"; verde e rosso solo per esiti (avanzo/sforamento); le quattro parti hanno sempre lo stesso colore ovunque.

### Tipografia
- **DM Serif Display**: titoli di pagina (30 px), numero del giorno (44–60 px), importo nel modulo (56 px).
- **DM Sans**: tutto il resto. Scala: 19 sezione · 16 testo · 14 secondario · 12 etichette maiuscole (+0.06em).
- Cifre sempre **tabellari** (`tabular-nums`) e separatore delle migliaia (1.330,11 €).

### Spaziature, raggi, ombre
- Griglia **4/8 px**: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40. Margine laterale 16 px.
- Raggi: 8 (piccoli), 12 (campi, pulsanti), 16 (card, tessere), 24 (riquadro del giorno, pannelli), pillola 999.
- Ombre: `--e1` card a riposo · `--e2` elementi sollevati · `--e3` pannelli e modali.

### Icone
Set unico disegnato (`src/ui/Icon.tsx`): griglia 24, tratto 1.75, estremità arrotondate. Niente emoji nell'interfaccia.
Dimensioni: 16 nei pulsanti, 18–20 nelle righe, 22–23 nella barra, 28 nel +.

### Componenti
- **Pulsanti**: primario (arancio, ombra leggera, scala .98 al tocco), secondario (superficie + bordo), testo (arancio), distruttivo (testo rosso). Altezze 34 / 44 / 52.
- **Campi**: raggio 12, focus con bordo arancio + alone 3 px; tendine con freccia disegnata. Nei moduli lunghi: righe in stile impostazioni (etichetta a sinistra, valore a destra).
- **Card**: superficie, bordo sottile, `--e1`, raggio 16, padding 18/16. Titolo come etichetta maiuscola piccola: il numero è il protagonista.
- **Tessere** (parti, categorie, scorciatoie): toccabili, scala .94–.97 al tocco, colore della parte.
- **Pannello dal basso** (`Sheet`): maniglia, si chiude toccando fuori, con Esc o trascinando giù.
- **Segmented control**: pillola bianca che scorre sotto la scelta.
- **Elenco impostazioni**: righe 56 px con icona in quadrato colorato e freccia ›.
- **Barra in alto**: contatori-pillola toccabili. **Barra in basso**: 4 voci + pulsante centrale rialzato; voce attiva con sfondo a pillola.
- **Anello** (`Ring`), **numero che sale** (`useCountUp`), **badge numerico** rosso.

### Animazioni
| Dove | Effetto | Durata |
|---|---|---|
| Cambio scheda | dissolvenza + salita di 8 px | 320 ms, ease-out |
| Pagina di impostazione | entrata da destra | 300 ms |
| Pannelli | salita dal basso / discesa | 320 / 220 ms |
| Numeri | conteggio da 0 | 700 ms, ease-out cubic |
| Anelli, barre | riempimento | 800–900 ms |
| Tocco | scala .9–.97, "molla" | 150 ms |
| Successi | "pop" dell'icona, fiamma | 400 ms |
Tutte disattivate con "Riduci movimento" del sistema. Vibrazione leggera al tocco su Android.

## 7. Prossimi passi consigliati
1. Scorrimento orizzontale tra i mesi in Movimenti e Analisi (swipe).
2. Ricerca e filtri nei movimenti (categoria, parte, importo).
3. Obiettivi di risparmio ("Vacanza: 600 € entro giugno") come tessere in Home.
4. Modalità scura rifinita sul riquadro del giorno e sulle medaglie.
5. Test con 5 tester: tempo per segnare una spesa e per trovare "quanto posso spendere oggi".
