# Landing page — testi aggiornati (italiano; chiavi di `public/home.js`)

Segue la struttura del sito di oggi (hero, calcolatore, "Una giornata", numeri, regola, come funziona, funzioni, privacy,
scarica, feedback, prezzi, FAQ), così i testi si applicano senza ridisegnare la pagina. Le traduzioni EN/FR/ES si fanno
quando si applica. Già sul sito dal 17/10: le 4 funzioni nuove nella griglia e il passo 7 «Niente sorprese».
Regole: BRIEF §12 (niente «AI», niente store, niente widget fuori dall'app, niente loghi di servizi).

## Hero
- `hero.eyebrow` **Beta gratuita · per chi vuole capire i propri soldi** *(prima: «Per studenti fuori sede · Beta gratuita» — lo studente resta il pubblico primario nel resto della pagina e nei contenuti)*
- `hero.title` **Cosa conta oggi, per i tuoi <em>soldi.</em>**
  - alternativa A: **Sai quanto puoi spendere <em>oggi.</em>** (attuale, più concreta)
  - alternativa B: **I tuoi soldi, in <em>quattro.</em>**
- `hero.lead` **Ogni mattina Quadriamo ti dice quanto puoi spendere oggi e cosa conta: un pagamento in arrivo, una bolletta da
  segnare, un abbonamento che è aumentato. Parti da quello che hai, al resto pensa lui.**
- `hero.b1` **Ogni mattina: il tuo numero e cosa conta** · `hero.b2` **Il calendario dei soldi, con promemoria discreti** ·
  `hero.b3` **Abbonamenti, documenti e la ricevuta del mese**
- `hero.cta` **Provala gratis** · `hero.note` **iPhone, Android e computer · Funziona offline · Dati nell'Unione europea**
- Immagine: la Home con «Adesso» (già: `site/<lingua>-<tema>-home.webp`, rigenerata il 17/10).

## Calcolatore
- `calc.title` **Calcola il tuo numero del giorno** (invariato) · `calc.cta` **Fallo ogni giorno, gratis**

## Una giornata con Quadriamo (story)
- `story.title` **Una giornata con Quadriamo** (invariato). Passi 1-6 invariati, passo 7 già online.
- Ritocco consigliato al passo 4 (`story.s4`): **Vedi subito quanto ti resta per oggi, e sotto cosa conta. Ogni mattina te lo ricorda una notifica.**

## Numeri (con fonte)
- `data.title` **Perché serve** (invariato) · `data.punch` **Non serve essere esperti. Serve sapere, ogni giorno, cosa conta.**

## Come funziona
- `how.title` **Come funziona**
- `how.1t` **Parti da dove sei** · `how.1` **Le entrate del mese e, se vuoi, i risparmi che hai già, ognuno con la sua regola.**
- `how.2t` **Il mese si organizza** · `how.2` **Quattro parti, il calendario dei pagamenti, i promemoria. Una spesa si segna in 5 secondi.**
- `how.3t` **Ogni mattina sai cosa conta** · `how.3` **Il tuo numero del giorno e, sotto, quello da fare. A fine mese, la ricevuta.**

## Funzioni (`feat.*`)
- `feat.title` **Le funzioni, in breve** (invariato). Ordine consigliato dei chip: Calendario e promemoria · Abbonamenti ·
  Ricevuta del mese · Documenti · Quanto puoi spendere oggi · Piano del giorno di paga · Capitale (*nuovo chip* — vedi sotto) ·
  Import e regole · Anno · Investimenti · Valute · Veloce ovunque.
- Nuovo chip `feat.capT` **Parti da dove sei** · `feat.cap` **I risparmi che hai già, divisi per uso (fondo di emergenza,
  liquidità, da far crescere, solo grandi acquisti), separati dal budget del mese. Vedi quanto è protetto e quanto puoi usare.**
- Nuovo chip `feat.newsT` **Notizie che servono** · `feat.news` **Poche notizie da 57 fonti approvate, con filtri e gli argomenti
  che segui. Si personalizzano sul telefono.**

## Prova (sezione nuova, opzionale, prima della privacy)
**Titolo** Fatto bene, in ogni dettaglio · **Testo** Ogni sezione ha il suo colore, le schermate si muovono come oggetti veri,
il vetro solo dove serve. La stessa app su telefono, tablet e computer.
**Prove (vere)**: «Oltre 200 test automatici a ogni versione» · «Dati nell'UE, niente pubblicità» · «Aggiornata ogni settimana: l’elenco delle novità è pubblico (CHANGELOG su GitHub)».
*(Niente numeri di utenti né recensioni finché non esistono.)*

## Privacy
- `priv.title` **I tuoi soldi sono affari tuoi** (invariato)
- `priv.text` **I tuoi dati stanno nel tuo account, su server nell'Unione europea, e li vedi solo tu. Gli importi delle notifiche
  li calcola il tuo telefono.**
- `priv.1` Niente pubblicità, niente vendita di dati · `priv.2` Non serve collegare la banca · `priv.3` **Documenti: solo nome e date,
  nessuna scansione** · `priv.4` Server nell'UE, connessioni cifrate

## Prezzi (invariati, veri)
- Beta: **Gratis** — tutte le funzioni, in cambio un parere. Pro: **In arrivo** — facoltativo, prezzo speciale per chi ha provato la beta.

## FAQ (riscritte e aggiunte)
1. **È sicuro?** Ogni utente vede solo i propri dati, su server nell'UE e con connessioni cifrate. Gli importi delle notifiche li calcola il tuo telefono.
2. **Devo collegare il conto in banca?** No. Segni le spese in pochi secondi o importi l'estratto conto (CSV), che legge solo il telefono.
3. **Mi manda troppe notifiche?** No: scegli tu cosa ricevere, le ore di silenzio, i giorni attivi e un massimo al giorno. Il permesso te lo chiediamo una volta sola.
4. **Come funzionano gli abbonamenti?** Li scegli da un catalogo di 80 servizi o li aggiungi tu; vedi quanto costano in un anno e quando aumentano.
5. **Devo caricare i documenti?** No: solo nome e scadenza. Nessuna scansione.
6. **Cos'è la ricevuta del mese?** Il riepilogo del mese come uno scontrino, da salvare o condividere. La crea il tuo telefono.
7. **Posso partire dai risparmi che ho?** Sì: nel Capitale li dividi per uso, separati dal budget del mese.
8. **Funziona senza internet?** Sì, una volta installata; si sincronizza quando torni online.
9. **Quanto costa?** Durante la beta è gratis. Più avanti ci sarà un piano Pro facoltativo; la versione gratuita resterà.
10. **È una consulenza finanziaria?** No: è uno strumento per organizzare i tuoi soldi. Le decisioni restano tue.

## SEO
- `<title>` **Quadriamo — I tuoi soldi, in quattro** · meta description: **Ogni mattina sai quanto puoi spendere oggi e cosa conta:
  calendario dei pagamenti, promemoria, abbonamenti, documenti e la ricevuta del mese. Gratis in beta.**
