# Quadriamo — web app (PWA)

Il budget planner 55-20-15-10 come web app installabile: una sola piattaforma per PC e telefono,
in italiano, inglese, francese e spagnolo. Il file Excel (repo `budget-planner`) resta solo come
versione di prova gratuita per amici e tester.

**Online:** https://carloludovicocapizzoto.github.io/quadriamo-app/ — si aggiorna da sola a ogni push su `main`
(GitHub Action `.github/workflows/deploy.yml`: test, build, pubblicazione su GitHub Pages).

## Comandi

```bash
npm install        # una volta
npm run dev        # anteprima su http://localhost:5173
npm test           # test del motore di calcolo e delle lingue
npm run build      # build di produzione in dist/ (con service worker per l'offline)
```

## Struttura

- `src/engine/` — motore di calcolo, senza interfaccia: bucket, riporti, ricorrenti, cambi, controlli,
  riepilogo annuale, investimenti. Riprende le formule dell'Excel; `engine.test.ts` usa gli stessi
  casi di `budget-planner/test_calc.py`, quindi i numeri coincidono.
- `src/i18n/` — dizionari `it`, `en`, `fr`, `es` (stesse chiavi, controllate da TypeScript e dai test).
  La lingua si sceglie dal browser e si può cambiare a mano; fallback inglese.
- `src/store/` — stato dell'app (reducer puro e testato), salvataggio su IndexedDB, backup JSON.
- `src/ui/` — schermate: benvenuto, Mese, Movimenti, Impostazioni, modulo di inserimento rapido.
- `src/demo.ts` — dati di esempio per provare l'app senza inserire niente.
- `public/` — icone, caratteri DM Sans / DM Serif Display (licenza OFL), favicon.

## Scelte di progetto

- Movimenti in un unico elenco: il mese si ricava dalla data (con giorno di inizio mese configurabile).
- Bucket e categorie hanno un **id** fisso; il nome visibile si traduce o si rinomina senza toccare i dati.
- Le date sono stringhe `YYYY-MM-DD`, senza fusi orari.
- Il "today" è un parametro del motore: i test sono deterministici.

Piano completo: [docs/PLAN.md](docs/PLAN.md).
