-- Notizie: podcast e immagini dei feed (vedi docs/NEWS-HUB.md, decisioni di Carlo del 13/10/2026).
-- Le immagini sono quelle che ogni fonte mette nel suo feed, caricate dal suo sito: noi salviamo solo l'indirizzo.
-- Se una fonte chiede di non mostrarle, si spengono da qui (images = false) senza toccare l'app.
-- Rieseguire non cambia niente.

alter table public.news_sources add column if not exists images boolean not null default true;

-- un tipo di fonte e un formato in più: il podcast
alter table public.news_sources drop constraint if exists news_sources_kind_check;
alter table public.news_sources add constraint news_sources_kind_check
  check (kind in ('press', 'independent', 'research', 'institution', 'video', 'podcast'));
alter table public.news_items drop constraint if exists news_items_format_check;
alter table public.news_items add constraint news_items_format_check
  check (format in ('article', 'research', 'video', 'podcast'));

-- i podcast di partenza, verificati il 13/10/2026 (feed pubblici e aggiornati). Si ascoltano sul sito del podcast.
-- Rational Reminder e The Money Guy Show ci sono già come video: stessi episodi, non si ripetono.
insert into public.news_sources (id, name, kind, format, feed, site, lang, country, trust, paywall, topics) values
  ('pod-thebull', 'The Bull · Riccardo Spada', 'podcast', 'rss', 'https://feeds.megaphone.fm/RICCARDOSPADA2271908995', 'https://www.spreaker.com/podcast/the-bull-il-tuo-podcast-di-finanza-personale--5880075', 'it', 'IT', 4, false, array['personal']),
  ('pod-marketmover', 'Market Mover · Il Sole 24 Ore', 'podcast', 'rss', 'https://feeds.megaphone.fm/ISOS1907906070', 'https://podcast.ilsole24ore.com/serie/market-mover-ADIwje3', 'it', 'IT', 4, false, array['markets']),
  ('pod-4soldi', '4 soldi da investire · Milano Finanza', 'podcast', 'rss', 'https://feeds.megaphone.fm/4soldidainvestire', 'https://www.milanofinanza.it', 'it', 'IT', 4, false, array['personal']),
  ('pod-planetmoney', 'Planet Money · NPR', 'podcast', 'rss', 'https://feeds.npr.org/510289/podcast.xml', 'https://www.npr.org/podcasts/510289/planet-money', 'en', 'US', 5, false, array['economy']),
  ('pod-indicator', 'The Indicator · NPR', 'podcast', 'rss', 'https://feeds.npr.org/510325/podcast.xml', 'https://www.npr.org/podcasts/510325/the-indicator-from-planet-money', 'en', 'US', 5, false, array['economy']),
  ('pod-animalspirits', 'Animal Spirits', 'podcast', 'rss', 'https://feeds.megaphone.fm/TCP6464651487', 'https://awealthofcommonsense.com/podcast/', 'en', 'US', 4, false, array['markets']),
  ('pod-oddlots', 'Odd Lots · Bloomberg', 'podcast', 'rss', 'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss', 'https://www.bloomberg.com/oddlots', 'en', 'US', 5, false, array['markets']),
  ('pod-affordanything', 'Afford Anything', 'podcast', 'rss', 'https://feeds.megaphone.fm/PDR2376775771', 'https://affordanything.com/podcast', 'en', 'US', 4, false, array['personal']),
  ('pod-bogleheads', 'Bogleheads On Investing', 'podcast', 'rss', 'https://feed.podbean.com/bogleheads/feed.xml', 'https://www.bogleheads.org', 'en', 'US', 4, false, array['etf']),
  ('pod-martingale', 'La Martingale', 'podcast', 'rss', 'https://feeds.audiomeans.fr/feed/647b907b-5a2f-4a11-94cb-591d604cb1b9.xml', 'https://lamartingale.io', 'fr', 'FR', 4, false, array['personal']),
  ('pod-finary', 'Finary', 'podcast', 'rss', 'https://anchor.fm/s/dbb2bc3c/podcast/rss', 'https://podcast.ausha.co/finary-talk', 'fr', 'FR', 3, false, array['personal']),
  ('pod-valueschool', 'Value School', 'podcast', 'rss', 'https://rss.libsyn.com/shows/122024/destinations/716040.xml', 'https://valueschool.libsyn.com', 'es', 'ES', 4, false, array['personal']),
  ('pod-economiaparatodos', 'Economía Para Todos · esRadio', 'podcast', 'rss', 'https://esradio.libertaddigital.com/economia-para-todos/podcast.xml', 'https://esradio.libertaddigital.com', 'es', 'ES', 3, false, array['economy'])
on conflict (id) do update set name = excluded.name, kind = excluded.kind, format = excluded.format, feed = excluded.feed,
  site = excluded.site, lang = excluded.lang, country = excluded.country, trust = excluded.trust, paywall = excluded.paywall, topics = excluded.topics;
