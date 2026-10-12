# Attivare feedback, statistiche, dashboard e notifiche (Supabase)

Da fare una volta, in quest'ordine. Tempo: circa 15 minuti.

**Più comodo:** apri l'area amministratore (`…/quadriamo-app/admin/`), accedi e vai su **Configurazione**: controlla da sola
cosa manca e per ogni passo ha il pulsante per copiare il codice già pronto (con la tua email e il codice del progetto).
Anteprima con dati di esempio: `…/quadriamo-app/admin/?demo=1`.

## 1. Tabelle e regole di sicurezza
Supabase → **SQL Editor** → **New snippet** → incolla tutto `supabase/migrations/0002_beta_feedback_stats_push.sql`
poi `supabase/migrations/0004_profiles.sql` (profili) e `supabase/migrations/0005_site_feedback.sql` (feedback dal sito,
con email facoltativa) → **Run**. La sezione Configurazione dell'area amministratore li copia già tutti insieme.
Deve comparire "Success. No rows returned".

## 1b. Registrazione con email e password
Authentication → **Sign In / Providers** → **Email**: lascia attivo, e finché non c'è un servizio email proprio (arriva con il
dominio) **disattiva "Confirm email"**: le email automatiche di Supabase arrivano solo agli indirizzi del team, quindi gli
amici non riceverebbero la conferma. Per lo stesso motivo "password dimenticata" e "link via email" funzionano davvero solo
dopo aver configurato l'SMTP. URL Configuration: Site URL `https://carloludovicocapizzoto.github.io/quadriamo-app/app/`,
Redirect URLs `https://carloludovicocapizzoto.github.io/quadriamo-app/**`.

## 2. Diventare amministratore
**Il modo più rapido (senza account):** apri `…/admin/`, scrivi il tuo nome, premi "Primo accesso? Genera un codice sicuro",
salva il codice (Note o portachiavi), premi Entra. In Configurazione "Copia lo script" contiene già il tuo nome e l'impronta
del codice (`supabase/migrations/0006_admin_key.sql`): incollalo nel SQL Editor e premi Run. Sugli altri dispositivi entri con
lo stesso nome e codice. Per revocarlo: `delete from public.admin_keys where name = 'Carlo';`

**Oppure con l'account:**
Nell'app (online) crea il tuo account (Impostazioni → Account e sincronizzazione → Crea account). Poi in **SQL Editor**:

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

## Email di conferma, accesso e password con lo stile di Quadriamo
- Authentication → Email Templates: per "Confirm signup", "Magic Link" e "Reset Password" incolla oggetto e testo da
  `supabase/templates/` (o dai pulsanti "Copia" in Area amministratore → Configurazione). Il testo cambia lingua da solo.
- Le email contengono un codice di 6 cifre (Email OTP Length = 6): si scrive nell'app installata, senza passare dal browser.
- Il servizio email gratuito di Supabase consegna solo agli indirizzi del team. Per gli amici serve un SMTP (Authentication →
  SMTP Settings). Senza dominio: casella Gmail dedicata con "password per le app" (smtp.gmail.com, porta 587), mittente
  "Quadriamo". Con il dominio: Resend (smtp.resend.com, porta 465, utente "resend", password = chiave API).

## Notifica del mattino, domanda ai tester, ritorno dopo 7 giorni (12/10/2026)
- Configurazione → passo 1: "Copia lo script" include `0008_morning_push_alternatives_cohorts.sql`.
- Passo 4: aggiorna la funzione `send-push` con il codice nuovo (modalità "morning").
- Passo 7 (facoltativo): `0009_morning_push_cron.sql` con `<CRON_SECRET>` → ogni mattina alle 7:30 "Oggi puoi spendere…".
  Il server manda solo la sveglia: il numero lo calcola il telefono (public/push-sw.js), gli importi non passano dal server.
