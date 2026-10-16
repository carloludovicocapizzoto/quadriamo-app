-- Una mail all'amministratore per ogni nuova segnalazione dei tester (0026): la manda la funzione report-email.
-- Indirizzo delle funzioni e segreto CRON si leggono dal programma del mattino (0009), che funziona già:
-- niente da sostituire a mano, e se il segreto cambia lì vale anche qui. Se il programma non c'è, nessuna mail
-- (la segnalazione si salva comunque). Rieseguire non cambia niente.

create or replace function public.email_new_report() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cmd text := (select command from cron.job where jobname = 'quadriamo-morning-spend');
  base text := substring(cmd from '(https://[^'']+/functions/v1/)');
  secret text := substring(cmd from '"x-cron-secret"\s*:\s*"([^"]+)"');
begin
  if base is not null and secret is not null then
    perform net.http_post(
      url := base || 'report-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
      body := jsonb_build_object('id', new.id)
    );
  end if;
  return new;
end $$;
revoke all on function public.email_new_report() from public, anon, authenticated;

drop trigger if exists tester_reports_email on public.tester_reports;
create trigger tester_reports_email after insert on public.tester_reports
  for each row execute function public.email_new_report();
