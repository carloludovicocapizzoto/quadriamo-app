-- Notizie → Financial Knowledge Hub, fase 1 (vedi docs/NEWS-HUB.md).
-- Un registro delle fonti approvate (con un voto di fiducia) e l'archivio dei contenuti raccolti ogni 2 ore dalla
-- funzione news-ingest. Si salvano solo titolo, estratto del feed, link, data e miniatura dei video: mai il testo.
-- Tutti possono leggere (sono notizie pubbliche, nessun dato personale); scrive solo la funzione (chiave di servizio).

create table if not exists public.news_sources (
  id         text primary key,                        -- breve e stabile, es. 'ft', 'yt-coletti'
  name       text not null,
  kind       text not null check (kind in ('press', 'independent', 'research', 'institution', 'video')),
  format     text not null default 'rss' check (format in ('rss', 'youtube')),
  feed       text not null,                           -- indirizzo del feed; per YouTube l'id del canale
  site       text,
  lang       text not null,                           -- it, en, es, fr
  country    text,
  trust      smallint not null check (trust between 1 and 5),   -- qualità, trasparenza, accuratezza, reputazione
  paywall    boolean not null default false,
  topics     text[] not null default '{}',           -- categoria tipica, aiuta a classificare
  active     boolean not null default true,
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
  format     text not null check (format in ('article', 'research', 'video')),
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
create policy "fonti attive: le legge chiunque" on public.news_sources for select to anon, authenticated using (active);
create policy "contenuti: li legge chiunque" on public.news_items for select to anon, authenticated using (true);
grant select on public.news_sources, public.news_items to anon, authenticated;

-- le fonti di partenza, verificate il 13/10/2026 (feed raggiungibili e aggiornati: tolti Calculated Risk e il blog
-- di Bogleheads, fermi). Rieseguire aggiorna, non duplica.
insert into public.news_sources (id, name, kind, format, feed, site, lang, country, trust, paywall, topics) values
  ('ansa', 'ANSA', 'press', 'rss', 'https://www.ansa.it/sito/notizie/economia/economia_rss.xml', 'https://www.ansa.it', 'it', 'IT', 4, false, array['economy']),
  ('sole24ore', 'Il Sole 24 Ore', 'press', 'rss', 'https://www.ilsole24ore.com/rss/finanza.xml', 'https://www.ilsole24ore.com', 'it', 'IT', 5, true, array['markets']),
  ('corriere', 'Corriere della Sera', 'press', 'rss', 'https://www.corriere.it/dynamic-feed/rss/section/Economia.xml', 'https://www.corriere.it', 'it', 'IT', 4, false, array['economy']),
  ('repubblica', 'la Repubblica', 'press', 'rss', 'https://www.repubblica.it/rss/economia/rss2.0.xml', 'https://www.repubblica.it', 'it', 'IT', 4, false, array['economy']),
  ('moneyit', 'Money.it', 'press', 'rss', 'https://www.money.it/spip.php?page=backend', 'https://www.money.it', 'it', 'IT', 3, false, array['personal']),
  ('ilpost', 'Il Post', 'press', 'rss', 'https://www.ilpost.it/economia/feed/', 'https://www.ilpost.it', 'it', 'IT', 5, false, array['economy']),
  ('bancaditalia', 'Banca d''Italia', 'institution', 'rss', 'https://www.bancaditalia.it/util/index.rss.html?lang=it', 'https://www.bancaditalia.it', 'it', 'IT', 5, false, array['economy']),
  ('ft', 'Financial Times', 'press', 'rss', 'https://www.ft.com/markets?format=rss', 'https://www.ft.com', 'en', 'GB', 5, true, array['markets']),
  ('economist', 'The Economist', 'press', 'rss', 'https://www.economist.com/finance-and-economics/rss.xml', 'https://www.economist.com', 'en', 'GB', 5, true, array['economy']),
  ('wsj', 'The Wall Street Journal', 'press', 'rss', 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', 'https://www.wsj.com', 'en', 'US', 5, true, array['markets']),
  ('marketwatch', 'MarketWatch', 'press', 'rss', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'https://www.marketwatch.com', 'en', 'US', 4, false, array['markets']),
  ('cnbc-pf', 'CNBC Personal Finance', 'press', 'rss', 'https://www.cnbc.com/id/21324812/device/rss/rss.html', 'https://www.cnbc.com', 'en', 'US', 4, false, array['personal']),
  ('cnbc', 'CNBC Finance', 'press', 'rss', 'https://www.cnbc.com/id/10000664/device/rss/rss.html', 'https://www.cnbc.com', 'en', 'US', 4, false, array['markets']),
  ('fortune', 'Fortune', 'press', 'rss', 'https://fortune.com/feed/', 'https://fortune.com', 'en', 'US', 4, false, array['economy']),
  ('kiplinger', 'Kiplinger', 'press', 'rss', 'https://www.kiplinger.com/feeds/all', 'https://www.kiplinger.com', 'en', 'US', 4, false, array['personal']),
  ('bbc', 'BBC Business', 'press', 'rss', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'https://www.bbc.com', 'en', 'GB', 5, false, array['economy']),
  ('lemonde', 'Le Monde Économie', 'press', 'rss', 'https://www.lemonde.fr/economie/rss_full.xml', 'https://www.lemonde.fr', 'fr', 'FR', 5, true, array['economy']),
  ('latribune', 'La Tribune', 'press', 'rss', 'https://www.latribune.fr/feed.xml', 'https://www.latribune.fr', 'fr', 'FR', 4, false, array['economy']),
  ('expansion', 'Expansión', 'press', 'rss', 'https://e00-expansion.uecdn.es/rss/economia.xml', 'https://www.expansion.com', 'es', 'ES', 4, false, array['economy']),
  ('awocs', 'A Wealth of Common Sense', 'independent', 'rss', 'https://awealthofcommonsense.com/feed/', 'https://awealthofcommonsense.com', 'en', 'US', 5, false, array['personal']),
  ('odad', 'Of Dollars and Data', 'independent', 'rss', 'https://ofdollarsanddata.com/feed/', 'https://ofdollarsanddata.com', 'en', 'US', 5, false, array['personal']),
  ('abnormal', 'Abnormal Returns', 'independent', 'rss', 'https://abnormalreturns.com/feed/', 'https://abnormalreturns.com', 'en', 'US', 4, false, array['markets']),
  ('noahpinion', 'Noahpinion', 'independent', 'rss', 'https://www.noahpinion.blog/feed', 'https://www.noahpinion.blog', 'en', 'US', 4, false, array['economy']),
  ('monevator', 'Monevator', 'independent', 'rss', 'https://monevator.com/feed/', 'https://monevator.com', 'en', 'GB', 5, false, array['personal']),
  ('bigpicture', 'The Big Picture', 'independent', 'rss', 'https://ritholtz.com/feed/', 'https://ritholtz.com', 'en', 'US', 4, false, array['markets']),
  ('klement', 'Klement on Investing', 'independent', 'rss', 'https://klementoninvesting.substack.com/feed', 'https://klementoninvesting.substack.com', 'en', 'CH', 4, false, array['psychology']),
  ('nber', 'NBER', 'research', 'rss', 'https://www.nber.org/rss/new.xml', 'https://www.nber.org', 'en', 'US', 5, false, array['economy']),
  ('bis', 'BIS', 'institution', 'rss', 'https://www.bis.org/doclist/reshub_papers.rss', 'https://www.bis.org', 'en', 'CH', 5, false, array['economy']),
  ('ecb-blog', 'BCE · Blog', 'institution', 'rss', 'https://www.ecb.europa.eu/rss/blog.html', 'https://www.ecb.europa.eu', 'en', 'EU', 5, false, array['economy']),
  ('ecb', 'BCE · Comunicati', 'institution', 'rss', 'https://www.ecb.europa.eu/rss/press.html', 'https://www.ecb.europa.eu', 'en', 'EU', 5, false, array['economy']),
  ('fed', 'Federal Reserve · FEDS Notes', 'institution', 'rss', 'https://www.federalreserve.gov/feeds/feds_notes.xml', 'https://www.federalreserve.gov', 'en', 'US', 5, false, array['economy']),
  ('voxeu', 'VoxEU · CEPR', 'research', 'rss', 'https://cepr.org/rss/vox-content', 'https://cepr.org', 'en', 'EU', 5, false, array['economy']),
  ('bruegel', 'Bruegel', 'research', 'rss', 'https://www.bruegel.org/rss.xml', 'https://www.bruegel.org', 'en', 'EU', 5, false, array['economy']),
  ('yt-puntoeconomico', 'il Punto Economico', 'video', 'youtube', 'UCAlNOYv6A-WMZ799N1iLMFA', 'https://www.youtube.com/@ilpuntoeconomico', 'it', 'IT', 4, false, array['economy']),
  ('yt-brunoinveste', 'Bruno Investe', 'video', 'youtube', 'UCNcEbCsJ80T2FXbZesFRajw', 'https://www.youtube.com', 'it', 'IT', 4, false, array['etf']),
  ('yt-mascellani', 'Bernardo Mascellani', 'video', 'youtube', 'UC4PokLZw0220_l2zdm4ydiw', 'https://www.youtube.com', 'it', 'IT', 3, false, array['personal']),
  ('yt-castagna', 'Giuseppe Castagna', 'video', 'youtube', 'UCFermqARa66pnGJVV1PnYGA', 'https://www.youtube.com', 'it', 'IT', 4, false, array['etf']),
  ('yt-mrrip', 'Mr. RIP', 'video', 'youtube', 'UCBOtZaVafz_5OmUrqJAVStQ', 'https://www.youtube.com', 'it', 'IT', 4, false, array['etf']),
  ('yt-coletti', 'Paolo Coletti', 'video', 'youtube', 'UCCnqSU06KXxGvPESASofSQA', 'https://www.youtube.com', 'it', 'IT', 5, false, array['etf']),
  ('yt-rationalreminder', 'Rational Reminder (Ben Felix)', 'video', 'youtube', 'UCOErWFfNOQzXsgE7f5S_ULw', 'https://www.youtube.com', 'en', 'CA', 5, false, array['etf']),
  ('yt-patrickboyle', 'Patrick Boyle', 'video', 'youtube', 'UCASM0cgfkJxQ1ICmRilfHLw', 'https://www.youtube.com', 'en', 'GB', 5, false, array['markets']),
  ('yt-plainbagel', 'The Plain Bagel', 'video', 'youtube', 'UCFCEuCsyWP0YkP3CZ3Mr01Q', 'https://www.youtube.com', 'en', 'CA', 5, false, array['personal']),
  ('yt-moneyguy', 'The Money Guy Show', 'video', 'youtube', 'UC9vUu4vlIlMC0dHQCTvQPbg', 'https://www.youtube.com', 'en', 'US', 4, false, array['personal']),
  ('yt-financialdiet', 'The Financial Diet', 'video', 'youtube', 'UCSPYNpQ2fHv9HJ-q6MIMaPw', 'https://www.youtube.com', 'en', 'US', 3, false, array['budget'])
on conflict (id) do update set name = excluded.name, kind = excluded.kind, format = excluded.format, feed = excluded.feed,
  site = excluded.site, lang = excluded.lang, country = excluded.country, trust = excluded.trust, paywall = excluded.paywall, topics = excluded.topics;
