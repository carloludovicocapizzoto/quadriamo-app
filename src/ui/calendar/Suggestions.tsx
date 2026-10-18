// Calendario → "Sembrano ricorrenti": spese ed entrate che tornano ogni mese nei tuoi movimenti (engine/suggest).
// Al massimo tre, discrete, in fondo: "Aggiungi" apre il modulo già compilato (si può cambiare tutto), "No" la scarta
// per sempre su questo dispositivo. Niente entra nel calendario senza la tua conferma.
import { useMemo, useState } from 'react'
import { suggestEvents, type CalEvent, type Suggestion } from '../../engine'
import { useI18n } from '../../i18n/core'
import { personal as local } from '../../storage'
import { useStore } from '../../store/context'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'
import { blankEvent } from './useEvents'

const OFF = 'q.calSuggestOff'

export function Suggestions({ today, onAdd }: { today: string; onAdd: (e: CalEvent) => void }) {
  const { t, date } = useI18n()
  const data = useStore().state.data!
  const [off, setOff] = useState<string[]>(() => local.json<string[]>(OFF, []))
  const list = useMemo(() => suggestEvents(data.transactions, data.settings.categories, data.settings.events, today, off),
    [data.transactions, data.settings.categories, data.settings.events, today, off])
  if (!list.length) return null

  const dismiss = (s: Suggestion) => { tap(); const next = [...off, s.key].slice(-200); setOff(next); local.setJson(OFF, next) }
  const add = (s: Suggestion) => {
    tap()
    onAdd(blankEvent(s.date, { kind: s.kind, title: s.title, amount: s.amount, category: s.kind === 'salary' || s.kind === 'income' ? null : s.category }))
  }
  return (
    <section className="group cal-suggest">
      <h2 className="group-title">{t('sug.title')}</h2>
      <ul className="group-list">{list.map(s => (
        <li key={s.key}><div className="row">
          <span className="row-main"><span>{s.title}</span>
            <small>{t('sug.line', { date: date(s.date, { day: 'numeric', month: 'short' }), n: s.count })}</small>
            <span className="sug-actions">
              <button className="link-btn" onClick={() => add(s)}>{t('sug.add')}</button>
              <button className="link-btn muted" onClick={() => dismiss(s)}>{t('sug.no')}</button>
            </span></span>
          <span className="row-value"><Money value={s.kind === 'salary' || s.kind === 'income' ? s.amount : -s.amount} currency={data.settings.currency} /></span>
        </div></li>))}
      </ul>
      <p className="group-foot">{t('sug.foot')}</p>
    </section>
  )
}
