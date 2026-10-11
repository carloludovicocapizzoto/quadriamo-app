# Quadriamo per Mac e Windows

Una finestra Electron che apre l'app pubblicata (`…/quadriamo-app/app/`). Il contenuto si aggiorna da solo dal sito;
questa cartella serve solo per la "cornice" scaricabile.

- **Mac:** `.dmg` con la finestra "trascina in Applicazioni" (Apple Silicon e Intel), firma locale ad-hoc. Senza firma
  Apple (Developer ID, 99 €/anno) al primo avvio va autorizzata in Impostazioni di Sistema → Privacy e sicurezza → Apri comunque.
- **Windows:** installer guidato (`Quadriamo-Windows-Setup.exe`). Senza certificato compare SmartScreen → Esegui comunque.
- **Aggiornamenti** (`updater.js`, electron-updater con GitHub Releases): Windows scarica e installa da solo; Mac avvisa e
  apre la pagina di download (l'installazione automatica su Mac richiede la firma Apple).

## Pubblicare una nuova versione
1. Aumenta `version` in `package.json` (es. 1.0.1).
2. `npm install` e poi `GH_TOKEN=$(gh auth token) npm run release` (compila Mac e Windows e pubblica la release `v1.0.1`
   su GitHub con i file `latest*.yml` che leggono gli aggiornamenti).
3. Le app già installate la trovano entro qualche ora (controllano all'avvio e ogni 6 ore).

I link della pagina Scarica puntano sempre all'ultima versione: `releases/latest/download/<nome file>`.
La pagina `public/inizia.html` si rigenera con `python3 tools/make_inizia.py`.
