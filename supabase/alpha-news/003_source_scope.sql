-- OPTIONAL ALPHA ONLY: apply after 001 and 002, only with explicit authorization. Idempotent; no data changes.
-- Per-source article scope: a feed can mix press releases with events, newsletters or signed papers
-- (ISTAT, ECB). When link_prefixes is not empty, ingestion keeps only links whose path starts with one of them.
begin;
do $$ begin
 if to_regclass('public.news_sources') is null then raise exception 'ALPHA_NEWS_PREREQUISITES'; end if;
end $$;
alter table public.news_sources add column if not exists link_prefixes text[] not null default '{}';
alter table public.news_sources drop constraint if exists news_sources_link_prefixes_paths;
alter table public.news_sources add constraint news_sources_link_prefixes_paths check (
 cardinality(link_prefixes) <= 10
 and array_to_string(link_prefixes, E'\n') !~ '(^|\n)([^/]|$)'
 and coalesce(array_position(link_prefixes, null), 0) = 0);
commit;
