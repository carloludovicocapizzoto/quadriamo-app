import { describe, expect, it } from 'vitest'
import { canonical, categorize, cleanTitle, clickbait, isJunk, keywords, level, relevance, SAME_EVENT, score, similarity } from '../../supabase/functions/_shared/news-rules'

describe('Knowledge Hub: regole', () => {
  it('categorie nelle quattro lingue, cripto riconosciute', () => {
    expect(categorize('La BCE taglia i tassi d’interesse: cosa cambia per i mutui')).toEqual(expect.arrayContaining(['economy', 'realestate']))
    expect(categorize('Why index funds beat stock pickers over 20 years')).toEqual(expect.arrayContaining(['etf', 'stocks']))
    expect(categorize('Le prix du pétrole recule')).toContain('commodities')
    expect(categorize('Bitcoin supera i 100.000 dollari')).toContain('crypto')
    expect(categorize('Un titolo qualsiasi', ['personal'])).toEqual(['personal'])
    expect(categorize('Bonus ai giovani per l’affitto')).not.toContain('ai')
    expect(categorize('How AI is changing wealth management')).toContain('ai')
  })
  it('livello e rilevanza', () => {
    expect(level('Cos’è un ETF e come funziona', 'video')).toBe('beginner')
    expect(level('Monetary policy transmission in the euro area', 'research')).toBe('advanced')
    expect(level('How to lose money betting against Europe', 'press')).toBe('intermediate')
    expect(level('Come iniziare a investire con 100 euro al mese', 'video')).toBe('beginner')
    expect(level('How to start investing in your 20s', 'press')).toBe('beginner')
    expect(relevance(['budget'])).toBe(1)
    expect(relevance(['economy'])).toBe(0.6)
    expect(relevance(['tech'])).toBe(0.3)
    expect(relevance(['economy'], false)).toBe(0.2)
  })
  it('clickbait e titoli senza sostanza', () => {
    expect(clickbait('Non crederai a quanto ho guadagnato!!')).toBeGreaterThan(0.6)
    expect(clickbait('L’inflazione scende al 2,1% a settembre')).toBe(0)
    expect(clickbait('QUESTO CAMBIERÀ TUTTO PER I RISPARMIATORI')).toBeGreaterThan(0.4)
    expect(isJunk('Borsa, la diretta di oggi')).toBe(true)
    expect(isJunk('Il mio portafoglio ETF #shorts')).toBe(true)
    expect(isJunk('Titoli "XS" [csv, 4.2 KB]')).toBe(true)
    expect(isJunk('Cedole CCT EU 2026 [pdf, 62.9 KB]')).toBe(true)
    expect(isJunk('Il PIL cresce dello 0,4%')).toBe(false)
  })
  it('titoli puliti: senza l’elenco degli autori', () => {
    expect(cleanTitle('Access to Capital and the IPO Decision -- by Andres Almazan, Nathan Swem')).toBe('Access to Capital and the IPO Decision')
  })
  it('stesso link = stesso contenuto, anche con il tracciamento', () => {
    expect(canonical('https://www.ft.com/content/abc?utm_source=rss&utm_medium=x#top')).toBe(canonical('https://ft.com/content/abc'))
  })
  it('stessa notizia da fonti diverse', () => {
    const a = keywords('ECB cuts interest rates by a quarter point as inflation slows')
    const b = keywords('Inflation slows, ECB cuts interest rates again')
    const c = keywords('Apple unveils new iPhone with satellite messaging')
    expect(similarity(a, b)).toBeGreaterThanOrEqual(SAME_EVENT)
    expect(similarity(a, c)).toBeLessThan(SAME_EVENT)
  })
  it('punteggio: fiducia e freschezza contano, il clickbait pesa', () => {
    const fresh = score({ trust: 5, ageHours: 2, relevance: 1, clickbait: 0 })
    expect(fresh).toBeGreaterThan(score({ trust: 5, ageHours: 48, relevance: 1, clickbait: 0 }))
    expect(fresh).toBeGreaterThan(score({ trust: 3, ageHours: 2, relevance: 1, clickbait: 0 }))
    expect(fresh).toBeGreaterThan(score({ trust: 5, ageHours: 2, relevance: 1, clickbait: 0.7 }))
  })
})

import { parse } from '../../supabase/functions/_shared/news-feed'
describe('Knowledge Hub: lettura dei feed', () => {
  it('RSS e Atom (anche con gli apostrofi), senza le frasi di servizio dei blog', () => {
    const rss = `<rss><channel><item><title>Rebalance?</title><link>https://a.com/x</link><pubDate>Mon, 13 Oct 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[It's time to rebalance. The post Rebalance? appeared first on A Wealth of Common Sense.]]></description></item></channel></rss>`
    const atom = `<feed><entry><title type='text'>Hotels</title><link rel='alternate' href='https://b.com/y'/><published>2026-10-12T08:00:00-05:00</published></entry></feed>`
    expect(parse(rss)[0]).toMatchObject({ title: 'Rebalance?', link: 'https://a.com/x', excerpt: "It's time to rebalance." })
    expect(parse(atom)[0]).toMatchObject({ title: 'Hotels', link: 'https://b.com/y' })
  })
})
