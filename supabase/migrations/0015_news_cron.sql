-- FACOLTATIVO: notifiche delle notizie principali. Ogni 2 ore dalle 9 alle 21 (ora italiana) la funzione guarda le notizie
-- delle ultime ore e, se ce n'è una importante per il budget, la manda (al massimo 2 al giorno).
-- Riusa la chiamata della notifica del mattino (stesso indirizzo e stesso segreto): non c'è niente da sostituire.

select cron.schedule(
  'quadriamo-news',
  '0 7,9,11,13,15,17,19 * * *',
  replace((select command from cron.job where jobname = 'quadriamo-morning-spend'), '"morning"', '"news"')
);

-- Per fermarle: select cron.unschedule('quadriamo-news');
