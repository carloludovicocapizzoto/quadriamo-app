-- Promemoria fino a mezzanotte: chi oggi non ha ancora aggiornato Quadriamo riceve il primo a un'ora a caso,
-- poi, finché non lo fa, un richiamo alle 21 e l'ultimo alle 23 (ora italiana). Al massimo 3 al giorno.
-- Il programma gira ogni ora dalle 7 alle 22 UTC: copre le 9-23 italiane sia con l'ora legale sia con quella solare
-- (le ore in più le scarta la funzione). Prima: ridistribuisci la funzione send-push aggiornata.

select cron.alter_job(
  (select jobid from cron.job where jobname = 'quadriamo-nudge'),
  schedule := '0 7-22 * * *'
);

-- Per tornare a prima: select cron.alter_job((select jobid from cron.job where jobname = 'quadriamo-nudge'), schedule := '0 7-19 * * *');
