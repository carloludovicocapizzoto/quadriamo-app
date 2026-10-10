-- FACOLTATIVO: promemoria automatico. Ogni giorno alle 18 (ora UTC) chiama la funzione "send-push",
-- che manda la richiesta di feedback a chi non ne riceve una da almeno 10 giorni.
-- Prima: Database -> Extensions -> attivare "pg_cron" e "pg_net".
-- Poi sostituire <PROJECT_REF> e <CRON_SECRET> (lo stesso valore messo nei segreti della funzione) ed eseguire.

select cron.schedule(
  'quadriamo-feedback-every-10-days',
  '0 18 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{"mode": "scheduled"}'::jsonb
  );
  $$
);

-- Per fermarlo: select cron.unschedule('quadriamo-feedback-every-10-days');
