# Quadriamo Admin per Mac e Windows

Finestra Electron che apre l'area amministratore (`…/quadriamo-app/admin/`): si entra con nome e codice amministratore.
Il contenuto si aggiorna dal sito a ogni apertura. Non è linkata nella pagina Scarica pubblica.

- Release su GitHub come **pre-release** `admin-vX.Y.Z` (così `releases/latest` resta quella di Quadriamo).
- All'avvio (e ogni 6 ore) l'app controlla se c'è una `admin-v` più nuova e propone di scaricarla.

## Nuova versione
1. Aumenta `version` in `package.json`.
2. `npm install && npm run build`
3. `gh release create admin-vX.Y.Z --prerelease dist/Quadriamo-Admin-Mac-arm64.dmg dist/Quadriamo-Admin-Mac-x64.dmg dist/Quadriamo-Admin-Windows-Setup.exe`
