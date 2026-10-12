-- FACOLTATIVO: notifica del mattino "Oggi puoi spendere…" alle 7:30 (ora italiana legale; 6:30 con l'ora solare).
-- Prima: pg_cron e pg_net attivi (come per il promemoria ogni 10 giorni) e la funzione send-push aggiornata.
-- Sostituire <CRON_SECRET> con lo stesso valore dei segreti della funzione, poi eseguire.

select cron.schedule(
  'quadriamo-morning-spend',
  '30 5 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{"mode": "morning"}'::jsonb
  );
  $$
);

-- Per fermarla: select cron.unschedule('quadriamo-morning-spend');
