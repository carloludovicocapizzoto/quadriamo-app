# Release Alpha — configurazione e accessi (solo nomi)

## Ultimo deployment Piano ON attestato

Riferimento del checkpoint del 2026-11-02: Production `quadriamo-alpha`, deployment `3d521481-176d-4a34-929c-42ee592f8fbe`, sorgente `88cde4b3d37aa5fc9f56e7ae9fd803342e145a9f`. Il Piano era ON e il feed News OFF. Non è una verifica live del 2026-11-03: rileggere l'ID Production prima di qualsiasi futura pubblicazione.

Fingerprint approvato della build Piano ON: `e5f6b2ff7af87d328a4496b13a464a0645b86e4ad4e2452e05749a0ff948dbcb`.

La release usa questi nomi di variabili (i valori non sono riportati):

- `ALPHA_SUPABASE_URL`
- `ALPHA_SUPABASE_PUBLISHABLE_KEY`
- `VITE_FLAGS`
- `ALPHA_MONTHLY_PLAN_APPROVED`
- `ALPHA_CLOUD_FEATURES`
- runtime Pages `ALPHA_NEWS_ENABLED`

Stato funzionale checkpoint: `monthly-plan` ON; `cloud:news` OFF; nessun secret o valore di chiave incluso in questo file.

## Accesso Supabase per Carlo

Supabase ha reso GA i Personal Access Token con scope il 6 ottobre 2026. Un PAT può essere limitato a progetti selezionati, permessi per capacità (read o read/write) e scadenza. Preferire un token temporaneo scoped al solo progetto Alpha e alla sola lettura necessaria; non inserire token in chat, Git, `.env` condivisi o log.

Nota CLI: il login browser standard della CLI crea ancora un token account-level; un PAT scoped si passa con `SUPABASE_ACCESS_TOKEN` oppure `supabase login --token`. `supabase whoami` non è supportato per PAT scoped. Le connessioni dirette Postgres con password non sono ristrette dagli scope del PAT: non consegnare una password DB come sostituto di un PAT read-only.

Riferimenti ufficiali:

- https://supabase.com/changelog/scoped-personal-access-tokens-ga
- https://supabase.com/docs/guides/platform/personal-access-tokens

Per la sola review Git non serve accesso cloud. Un token Cloudflare Pages Edit temporaneo e limitato all'account è da creare soltanto quando Carlo deve eseguire un'operazione Cloudflare esplicitamente autorizzata; non è incluso né creato in questo handoff.
