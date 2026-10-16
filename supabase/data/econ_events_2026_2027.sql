-- Eventi economici per il widget della Home (tabella econ_events, 0023): le riunioni di politica monetaria di BCE e Fed,
-- da ottobre 2026 a dicembre 2027, dai calendari ufficiali (consultati il 16/10/2026; le date Fed del 2027 sono provvisorie
-- finché la Fed non le conferma). Per BCE è il giorno dell'annuncio, per la Fed l'ultimo giorno della riunione.
-- Rieseguire non crea doppioni. Altre date (es. ISTAT) si aggiungono con una riga come queste.
insert into public.econ_events (day, title_it, title_en, title_fr, title_es, url)
select v.day::date, v.title_it, v.title_en, v.title_fr, v.title_es, v.url from (values
  ('2026-10-28', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2026-10-29', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2026-12-09', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2026-12-17', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-01-27', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-02-04', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-03-17', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-03-18', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-04-28', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-04-29', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-06-09', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-06-10', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-07-22', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-07-28', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-09-09', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-09-15', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-10-27', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-10-28', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'),
  ('2027-12-08', 'Fed: decisione sui tassi', 'Fed: interest rate decision', 'Fed : décision sur les taux', 'Fed: decisión sobre los tipos', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('2027-12-16', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'BCE : décision sur les taux', 'BCE: decisión sobre los tipos', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html')
) as v(day, title_it, title_en, title_fr, title_es, url)
where not exists (select 1 from public.econ_events e where e.day = v.day::date and e.title_en = v.title_en);
