# Quadriamo Admin per Mac e Windows (solo per l'amministratore)

Finestra Electron che apre l'area amministratore (`…/quadriamo-app/admin/`): si entra con nome e codice amministratore.
Il contenuto si aggiorna dal sito a ogni apertura, quindi una nuova versione dell'app serve di rado.

**Non è pubblicata:** niente link nel sito, niente release su GitHub. I file di installazione stanno sul Mac di Carlo in
`~/Desktop/Quadriamo/Quadriamo Admin/` (Mac Apple Silicon, Mac Intel, Windows).

## Nuova versione
1. Aumenta `version` in `package.json`.
2. `npm install && npm run build`
3. Copia `dist/Quadriamo-Admin-*.dmg` e `dist/Quadriamo-Admin-Windows-Setup.exe` nella cartella sul Desktop e installala
   al posto di quella vecchia.
