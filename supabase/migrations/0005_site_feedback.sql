-- Feedback anche dal sito: email facoltativa (per poter rispondere) e provenienza (app o sito).
alter table public.feedback add column if not exists email text check (char_length(email) <= 200);
alter table public.feedback add column if not exists source text not null default 'app' check (source in ('app', 'site'));

-- serve solo alla pagina Configurazione dell'area amministratore per sapere se questo script è stato eseguito
create or replace function public.site_feedback_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.site_feedback_ready() to authenticated;
