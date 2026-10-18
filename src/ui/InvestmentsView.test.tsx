import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyInvestments, type Holding } from '../engine'
import { I18nProvider } from '../i18n'
import en from '../i18n/en'
import es from '../i18n/es'
import fr from '../i18n/fr'
import itDict from '../i18n/it'
import { StoreContext } from '../store/context'
import { InvestmentsView } from './InvestmentsView'

const dicts = { it: itDict, en, fr, es }
const h: Holding = { id: 'test', name: 'Test', units: 0.12345678, avgPrice: 100, manualPrice: null }
function render(lang: keyof typeof dicts, holding = h) {
  const settings = defaultSettings({ firstMonth: { year: 2026, month: 10 } })
  const data = { version: 1 as const, settings, transactions: [], investments: { ...emptyInvestments(), holdings: [holding] } }
  return renderToStaticMarkup(<I18nProvider start={{ lang, dict: dicts[lang] }}>
    <StoreContext.Provider value={{ state: { loaded: true, data }, dispatch: () => {} }}>
      <InvestmentsView settings={settings} transactions={[]} today="2026-10-17" year={2026} onYear={() => {}} />
    </StoreContext.Provider>
  </I18nProvider>)
}

describe('investimenti: valori incompleti e precisione nella UI', () => {
  it.each(['it', 'en', 'fr', 'es'] as const)('%s: mostra il valore mancante e conserva le quantità', lang => {
    const html = render(lang)
    expect(html).toContain('<span class="outcome-amount">—</span>')
    expect(html).toContain(dicts[lang]['inv.incomplete'])
    expect(html).toContain(`value="${lang === 'en' ? '0.12345678' : '0,12345678'}"`)
    expect(html).not.toContain('-100%')
  })
  it('un prezzo mancante in valuta estera non genera un falso errore di cambio', () => {
    const html = render('en', { ...h, currency: 'EUR' })
    expect(html).not.toContain('Missing exchange rate for EUR')
    expect(html).toContain('price missing')
  })
  it('un cambio mancante non viene chiamato prezzo mancante', () => {
    const html = render('en', { ...h, currency: 'XYZ', manualPrice: 10 })
    expect(html).toContain('Missing exchange rate for XYZ')
    expect(html).not.toContain('price missing')
  })
})
