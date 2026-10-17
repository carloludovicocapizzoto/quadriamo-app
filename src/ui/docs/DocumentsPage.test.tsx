import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { computeMonth, defaultSettings, type CalEvent } from '../../engine'
import { I18nProvider } from '../../i18n'
import type { Lang } from '../../i18n/core'
import en from '../../i18n/en'
import es from '../../i18n/es'
import fr from '../../i18n/fr'
import itDict from '../../i18n/it'
import { StoreContext } from '../../store/context'
import type { AppData } from '../../store/state'
import { Documents } from '../home/widgetsPlan'
import { DocumentsPage } from './DocumentsPage'
import { Now } from '../home/Now'

const today = '2026-10-17'
const dicts = { it: itDict, en, fr, es }
const doc = (id: string, date: string): CalEvent => ({
  id, date, title: `Document ${id}`, kind: 'document', amount: null, category: null,
  repeat: null, until: null, done: [], active: true, doc: { category: 'personal' },
})

function render(lang: Lang, events: CalEvent[], widget: boolean | 'now' = false) {
  const data: AppData = { version: 1, settings: { ...defaultSettings({ firstMonth: { year: 2026, month: 10 } }), events }, transactions: [] }
  const c = { data, today, r: computeMonth({ year: 2026, month: 10 }, [], data.settings, today),
    streak: null, parts: null, daily: 0, onOpen: () => {}, onAll: () => {} }
  return renderToStaticMarkup(
    <I18nProvider start={{ lang, dict: dicts[lang] }}>
      <StoreContext.Provider value={{ state: { loaded: true, data }, dispatch: () => {} }}>
        {widget === 'now' ? <Now data={data} r={c.r} today={today} hasPlan={false} onLog={() => {}} />
          : widget ? <Documents c={c} box={body => <section>{body}</section>} /> : <DocumentsPage today={today} />}
      </StoreContext.Provider>
    </I18nProvider>,
  )
}

describe('documenti: singolari e plurali nelle quattro lingue', () => {
  it.each([
    ['it', '1 documento', '2 documenti'], ['en', '1 document', '2 documents'],
    ['fr', '1 document', '2 documents'], ['es', '1 documento', '2 documentos'],
  ] as const)('%s: il riepilogo distingue uno e più documenti', (lang, one, many) => {
    expect(render(lang, [doc('a', '2027-04-01')])).toContain(`>${one}</p>`)
    expect(render(lang, [doc('a', '2027-04-01'), doc('b', '2027-05-01')])).toContain(`>${many}</p>`)
  })

  it.each([
    ['it', 'Tra 1 giorno', 'Tra 2 giorni', 'Scaduto da 1 giorno', 'Scaduto da 2 giorni'],
    ['en', 'In 1 day', 'In 2 days', 'Expired 1 day ago', 'Expired 2 days ago'],
    ['fr', 'Dans 1 jour', 'Dans 2 jours', 'Expiré depuis 1 jour', 'Expiré depuis 2 jours'],
    ['es', 'En 1 día', 'En 2 días', 'Vencido hace 1 día', 'Vencido hace 2 días'],
  ] as const)('%s: pagina e widget concordano sui giorni prima e dopo la scadenza', (lang, one, many, expiredOne, expiredMany) => {
    for (const widget of [false, true]) {
      for (const [date, text] of [['2026-10-18', one], ['2026-10-19', many], ['2026-10-16', expiredOne], ['2026-10-15', expiredMany]])
        expect(render(lang, [doc('a', date)], widget)).toMatch(new RegExp(`${text}(?= ·|<)`))
      expect(render(lang, [doc('a', today)], widget)).toContain(dicts[lang]['doc.today'])
    }
  })

  it.each([
    ['it', 'Da 1 giorno · rinnovalo', 'Da 2 giorni · rinnovalo', 'e un altro'],
    ['en', '1 day ago · renew it', '2 days ago · renew it', 'and 1 more'],
    ['fr', 'Depuis 1 jour · renouvelez-le', 'Depuis 2 jours · renouvelez-le', 'et un autre'],
    ['es', 'Hace 1 día · renuévalo', 'Hace 2 días · renuévalo', 'y 1 más'],
  ] as const)('%s: Adesso e gli altri documenti usano il singolare', (lang, one, many, more) => {
    expect(render(lang, [doc('a', '2026-10-16')], 'now')).toContain(one)
    expect(render(lang, [doc('a', '2026-10-15')], 'now')).toContain(many)
    expect(render(lang, [doc('a', '2026-11-01'), doc('b', '2026-12-01')], true)).toContain(more)
  })
})
