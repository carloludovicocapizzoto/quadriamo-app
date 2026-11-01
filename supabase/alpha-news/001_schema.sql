-- OPTIONAL ALPHA ONLY: no sources seeded, no cron enabled. Apply only after explicit approval.
begin;
-- Notizie → Financial Knowledge Hub, fase 1 (vedi docs/NEWS-HUB.md).
-- Un registro delle fonti approvate (con un voto di fiducia) e l'archivio dei contenuti raccolti ogni 2 ore dalla
-- funzione news-ingest. Si salvano solo titolo, estratto del feed, link, data e miniatura dei video: mai il testo.
-- Tutti possono leggere (sono notizie pubbliche, nessun dato personale); scrive solo la funzione (chiave di servizio).

create table if not exists public.news_sources (
  id         text primary key,                        -- breve e stabile, es. 'ft', 'yt-coletti'
  name       text not null,
  kind       text not null check (kind in ('press', 'independent', 'research', 'institution', 'video', 'podcast')),
  format     text not null default 'rss' check (format in ('rss', 'youtube')),
  feed       text not null,                           -- indirizzo del feed; per YouTube l'id del canale
  site       text,
  lang       text not null,                           -- it, en, es, fr
  country    text,
  trust      smallint not null check (trust between 1 and 5),   -- qualità, trasparenza, accuratezza, reputazione
  paywall    boolean not null default false,
  topics     text[] not null default '{}',           -- categoria tipica, aiuta a classificare
  active     boolean not null default false,
  origin     text not null default 'curated' check (origin in ('curated', 'discovered')),
  last_ok    timestamptz,
  last_count integer,
  last_error text
);

create table if not exists public.news_items (
  id         text primary key,                        -- impronta del link canonico (niente doppioni)
  source_id  text not null references public.news_sources(id) on delete cascade,
  title      text not null,
  excerpt    text,                                    -- l'estratto che la fonte pubblica nel feed, accorciato
  link       text not null,
  thumb      text,                                    -- solo per i video (miniatura di YouTube)
  published  timestamptz not null,
  lang       text not null,
  format     text not null check (format in ('article', 'research', 'video', 'podcast')),
  categories text[] not null default '{}',
  level      text not null default 'intermediate' check (level in ('beginner', 'intermediate', 'advanced')),
  minutes    smallint,
  relevance  real not null default 0,                 -- quanto riguarda la finanza personale (0-1)
  score      real not null default 0,                 -- fiducia x freschezza x rilevanza, meno il clickbait
  cluster    text,                                    -- stessa notizia da più fonti: stesso valore
  crypto     boolean not null default false,          -- le cripto stanno in una scheda a parte
  created_at timestamptz not null default now()
);
create index if not exists news_items_published on public.news_items (published desc);
create index if not exists news_items_cluster on public.news_items (cluster);

alter table public.news_sources enable row level security;
alter table public.news_items enable row level security;
drop policy if exists "fonti attive: le legge chiunque" on public.news_sources;
drop policy if exists "contenuti: li legge chiunque" on public.news_items;
create policy "fonti attive: le legge chiunque" on public.news_sources for select to authenticated using (active);
create policy "contenuti: li legge chiunque" on public.news_items for select to authenticated using (exists (select 1 from public.news_sources s where s.id = source_id and s.active));
grant select on public.news_sources, public.news_items to authenticated;


alter table public.news_sources add column images boolean not null default false;
alter table public.news_sources add column last_attempt timestamptz;
revoke all on public.news_items, public.news_sources from anon;
grant all on public.news_items, public.news_sources to service_role;
alter table public.news_sources add column rights_reference text;
alter table public.news_sources add column approved_by text;
alter table public.news_sources add constraint active_source_approval check (not active or (length(trim(coalesce(rights_reference,'')))>0 and length(trim(coalesce(approved_by,'')))>0));
alter table public.news_items add constraint alpha_news_metadata_bounds check (length(title) between 1 and 500 and length(link)<=2048);
commit;
