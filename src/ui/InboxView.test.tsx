import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import itDict from '../i18n/it'
import { StoreContext } from '../store/context'
import { createInitial, planImport } from '../store/state'
import { InboxView } from './InboxView'

// P1.2: una riga «forse già importata» è visibile nella casella, con la nota e le due scelte, e non entra in «Conferma tutti».
describe('casella: righe da verificare', () => {
  it('mostra la nota, «Aggiungi comunque» ed «È la stessa», e la esclude da «Conferma tutti»', () => {
    const data = createInitial('EUR', '2026-10-01')
    data.importDone = { '2026-10-28|-5.00|qa bonifico': '2026-10-20T10:00:00Z' }
    const rows = [{ date: '2026-10-28', description: 'QA Bonifico', amount: -5, currency: 'USD' },
      { date: '2026-10-29', description: 'QA Esselunga', amount: -10, currency: null },
      { date: '2026-10-30', description: 'QA Esselunga due', amount: -11, currency: null }]
    data.inbox = planImport(data, rows).items.map(i => ({ ...i, category: i.category ?? 'other' }))
    expect(data.inbox.map(i => i.maybeImported)).toEqual([true, undefined, undefined])
    const html = renderToStaticMarkup(<I18nProvider start={{ lang: 'it', dict: itDict }}>
      <StoreContext.Provider value={{ state: { loaded: true, data }, dispatch: () => {} }}>
        <InboxView settings={data.settings} />
      </StoreContext.Provider>
    </I18nProvider>)
    expect(html).toContain('QA Bonifico')
    expect(html).toContain(itDict['inbox.maybeImported'])
    expect(html).toContain(itDict['inbox.addAnyway'])
    expect(html).toContain(itDict['inbox.same'])
    expect(html).toContain(itDict['inbox.confirmAll'].replace('{n}', '2'))
  })
})
