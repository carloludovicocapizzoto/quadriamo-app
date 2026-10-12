-- 12/10/2026 — promemoria "a sorpresa" per chi oggi non ha ancora aggiornato Quadriamo (aiuta lo "slancio").
-- L'app comunica solo la DATA dell'ultimo aggiornamento (niente importi, niente movimenti). Il server, a un'ora a caso
-- del pomeriggio, sveglia il telefono; il testo (con i giorni di slancio) lo scrive il telefono con i suoi dati.

alter table public.push_subscriptions add column if not exists last_active date;
alter table public.push_subscriptions add column if not exists last_nudge_at timestamptz;

-- "oggi ho aggiornato": vale per questo dispositivo e, con l'accesso, per tutti i dispositivi dello stesso account
create or replace function public.touch_push(p_endpoint text, p_day date)
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions
  set last_active = greatest(coalesce(last_active, p_day), least(p_day, (now() at time zone 'utc')::date + 1))
  where endpoint = p_endpoint or (auth.uid() is not null and user_id = auth.uid());
$$;
revoke all on function public.touch_push(text, date) from public;
grant execute on function public.touch_push(text, date) to anon, authenticated;

-- la notifica del mattino è inclusa per tutti quelli che hanno le notifiche attive
update public.push_subscriptions set morning = true where not morning;
alter table public.push_subscriptions alter column morning set default true;
