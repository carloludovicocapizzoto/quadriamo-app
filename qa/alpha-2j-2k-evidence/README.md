# Consegna QA Alpha 2J/2K (sanitizzata)

Questa cartella è un riepilogo operativo, non un'autorizzazione a modificare il cloud. Il repository è pubblico: qui non sono inclusi email, UUID utente, token, password, file di backup o payload finanziari grezzi. L'account QA è indicato soltanto con l'alias `QA C`; gli importi descritti sono sintetici e limitati ai valori necessari per riprodurre il test.

## File

- `piano.md`: prove Piano 2J/2K e stato della fixture temporanea.
- `notizie.md`: stato backend News, fonti e gate residui.
- `build-config.md`: ultimo deployment Piano ON verificato e soli nomi delle variabili di build.

**Attenzione immediata per QA C:** l'avviso è stato riprodotto in Production e persistito dopo reload. La rimozione dell'unico movimento di prova è rimasta senza conferma verificabile; finché non viene riconciliata dalla UI, considerare la fixture ancora presente e non eseguire altre scritture.
