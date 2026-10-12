-- FACOLTATIVO: promemoria "a sorpresa" per chi oggi non ha ancora aggiornato Quadriamo.
-- Ogni ora la funzione sceglie a caso se scrivere, tra le 9 e le 20 (ora italiana):
-- al massimo una volta al giorno a persona, e solo a chi oggi non ha ancora segnato niente.
-- Riusa la chiamata della notifica del mattino (stesso indirizzo e stesso segreto), quindi non c'è niente da sostituire.

select cron.schedule(
  'quadriamo-nudge',
  '0 7-19 * * *',
  replace((select command from cron.job where jobname = 'quadriamo-morning-spend'), '"morning"', '"nudge"')
);

-- Per fermarlo: select cron.unschedule('quadriamo-nudge');
