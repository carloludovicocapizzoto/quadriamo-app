-- OPTIONAL ALPHA ONLY: apply after 001 and 002, only with explicit authorization. Idempotent; no data changes.
-- Per-source article scope: a feed can mix press releases with events, newsletters or signed papers
-- (ISTAT, ECB). When link_prefixes is not empty, ingestion keeps only links whose path starts with one of them.
-- Attribution: the credit shown next to each headline (e.g. «Fonte: Istat · CC BY 4.0») and the licence it links to.
begin;
do $$ begin
 if to_regclass('public.news_sources') is null then raise exception 'ALPHA_NEWS_PREREQUISITES'; end if;
end $$;
alter table public.news_sources add column if not exists link_prefixes text[] not null default '{}';
alter table public.news_sources drop constraint if exists news_sources_link_prefixes_paths;
alter table public.news_sources add constraint news_sources_link_prefixes_paths check (
 cardinality(link_prefixes) <= 10
 and (cardinality(link_prefixes) = 0 or array_to_string(link_prefixes, E'\n') !~ '(^|\n)([^/]|$)')
 and coalesce(array_position(link_prefixes, null), 0) = 0);
alter table public.news_sources add column if not exists attribution text;
alter table public.news_sources add column if not exists licence_name text;
alter table public.news_sources add column if not exists licence_url text;
alter table public.news_sources drop constraint if exists news_sources_attribution_bounds;
alter table public.news_sources add constraint news_sources_attribution_bounds check (
 coalesce(length(attribution), 0) <= 120 and coalesce(length(licence_name), 0) <= 60
 and (licence_url is null or (licence_url ~ '^https://[^/@:]+\.[^/@:]+/' and length(licence_url) <= 2048))
 and ((licence_name is null) = (licence_url is null)));
-- An active source always carries its credit line.
alter table public.news_sources drop constraint if exists news_sources_active_attribution;
alter table public.news_sources add constraint news_sources_active_attribution check (not active or length(trim(coalesce(attribution, ''))) > 0);
commit;
