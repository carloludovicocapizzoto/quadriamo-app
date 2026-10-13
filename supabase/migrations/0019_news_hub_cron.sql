-- Raccolta del Knowledge Hub ogni 2 ore, giorno e notte (al quarto d'ora, per non sovrapporsi alle notifiche).
-- Riusa la chiamata della notifica del mattino (stesso progetto e stesso segreto) cambiando funzione: niente da sostituire.
-- Prima: lo script 0018_news_hub.sql e la funzione news-ingest pubblicata (con "Verify JWT" spento).

select cron.unschedule('quadriamo-news-hub') where exists (select 1 from cron.job where jobname = 'quadriamo-news-hub');
select cron.schedule(
  'quadriamo-news-hub',
  '15 */2 * * *',
  replace(replace((select command from cron.job where jobname = 'quadriamo-morning-spend'), '/send-push', '/news-ingest'), '"morning"', '"ingest"')
);

-- Una prima raccolta subito, senza aspettare il prossimo giro:
select net.http_post(
  url := substring((select command from cron.job where jobname = 'quadriamo-news-hub') from 'url := ''([^'']+)'''),
  headers := substring((select command from cron.job where jobname = 'quadriamo-news-hub') from 'headers := ''([^'']+)''')::jsonb,
  body := '{"mode": "ingest"}'::jsonb
);

-- Per fermarla: select cron.unschedule('quadriamo-news-hub');
