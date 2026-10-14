-- Il promemoria di feedback ogni 10 giorni (0003) era scritto con indirizzo e segreto da sostituire a mano
-- e il 13/10/2026 è fallito. Lo ricreiamo copiando indirizzo e segreto dal programma del mattino, che funziona:
-- stesso orario (20:00 italiane d'estate, 19:00 d'inverno), stessa funzione send-push, modo "scheduled".
-- Rieseguire non cambia niente.
select cron.unschedule('quadriamo-feedback-every-10-days') where exists (select 1 from cron.job where jobname = 'quadriamo-feedback-every-10-days');
select cron.schedule(
  'quadriamo-feedback-every-10-days',
  '0 18 * * *',
  replace((select command from cron.job where jobname = 'quadriamo-morning-spend'), '"morning"', '"scheduled"')
);
