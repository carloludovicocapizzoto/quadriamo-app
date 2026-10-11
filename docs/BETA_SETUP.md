# Attivare feedback, statistiche, dashboard e notifiche (Supabase)

Da fare una volta, in quest'ordine. Tempo: circa 15 minuti.

**Più comodo:** apri l'area amministratore (`…/quadriamo-app/admin/`), accedi e vai su **Configurazione**: controlla da sola
cosa manca e per ogni passo ha il pulsante per copiare il codice già pronto (con la tua email e il codice del progetto).
Anteprima con dati di esempio: `…/quadriamo-app/admin/?demo=1`.

## 1. Tabelle e regole di sicurezza
Supabase → **SQL Editor** → **New snippet** → incolla tutto `supabase/migrations/0002_beta_feedback_stats_push.sql` → **Run**.
Deve comparire "Success. No rows returned".

## 2. Diventare amministratore
Nell'app (online) fai l'accesso con la tua email (Impostazioni → Account e sincronizzazione). Poi in **SQL Editor**:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'LA-TUA-EMAIL';
```

Da quel momento in Impostazioni → Beta compare **Dashboard amministratore** (oppure apri `…/admin/`).

## 3. Funzione per inviare le notifiche
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome: `send-push`. Incolla tutto `supabase/functions/send-push/index.ts` → **Deploy**.
3. Nelle impostazioni della funzione disattiva **Enforce JWT verification** (la funzione controlla da sola chi la chiama).
4. Edge Functions → **Secrets** → aggiungi i tre valori che trovi nel file locale `.vapid.local`
   (sul tuo Mac, nella cartella del progetto; non va mai su GitHub):
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`.

Ora dalla dashboard il pulsante **Invia notifica di feedback** funziona.

## 4. (Facoltativo) Promemoria automatico ogni 10 giorni
1. Database → **Extensions** → attiva `pg_cron` e `pg_net`.
2. Apri `supabase/migrations/0003_feedback_push_every_10_days.sql`, sostituisci `<PROJECT_REF>` (il codice del progetto,
   quello nell'URL di Supabase) e `<CRON_SECRET>` (lo stesso di `.vapid.local`), poi eseguilo nel SQL Editor.

Ogni giorno alle 18 (UTC) parte la richiesta di feedback verso chi non ne riceve una da almeno 10 giorni.
Indipendentemente da questo, l'app stessa mostra il riquadro "Come ti trovi?" ogni 10 giorni.

## Note
- Le statistiche partono solo dai dispositivi che hanno detto sì al consenso.
- Su iPhone le notifiche funzionano solo con l'app installata sulla schermata Home (iOS 16.4 o successivi).
- Privacy policy già aggiornata con statistiche, feedback e notifiche.
