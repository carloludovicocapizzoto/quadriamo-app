import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultSettings, todayIso } from '../engine'
import { I18nProvider } from '../i18n'
import en from '../i18n/en'
import es from '../i18n/es'
import fr from '../i18n/fr'
import itDict from '../i18n/it'
import { TxForm } from './TxForm'

const dicts = { it: itDict, en, fr, es }
// il 29 ottobre di quest'anno: la data senza anno vale per l'anno in corso
const THIS_YEAR = `${todayIso().slice(0, 4)}-10-29`
function render(lang: keyof typeof dicts, currency = 'EUR', date = THIS_YEAR) {
  const settings = { ...defaultSettings({ firstMonth: { year: 2026, month: 10 } }), currency }
  return renderToStaticMarkup(<I18nProvider start={{ lang, dict: dicts[lang] }}>
    <TxForm settings={settings} defaultDate={date} onSave={() => {}} onClose={() => {}} />
  </I18nProvider>)
}

describe('nuovo movimento: lo zero di esempio, la data e il «+»', () => {
  it.each([['it', '0,00'], ['en', '0.00'], ['fr', '0,00'], ['es', '0,00']] as const)('%s: lo zero usa il separatore della lingua (%s)', (lang, zero) => {
    expect(render(lang)).toContain(`placeholder="${zero}"`)
  })
  it('lo zero ha i decimali della valuta: JPY nessuno, KWD tre', () => {
    expect(render('en', 'JPY')).toContain('placeholder="0"')
    expect(render('en', 'KWD')).toContain('placeholder="0.000"')
  })
  it.each(['it', 'en', 'fr', 'es'] as const)('%s: la data si legge corta e il «+» ha il testo della lingua', lang => {
    const html = render(lang)
    expect(html).toContain(dicts[lang]['settings.newCategory'])
    expect(html).toContain('class="cat-add"')
    expect(html).toMatch(/class="txs-day">(29 ott|Oct 29|29 oct\.|29 oct)</)
  })
  it('una data di un altro anno mostra anche l\'anno', () => {
    expect(render('en', 'EUR', '2025-12-31')).toContain('Dec 31, 2025')
  })
})
