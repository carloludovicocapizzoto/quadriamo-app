// Profilo → Pagamenti ricorrenti (e il passaggio della configurazione iniziale): gli eventi del calendario che si ripetono
// e fanno uscire soldi, con la prossima data e le rate che restano. Sono gli stessi del calendario, visti dal lato delle spese fisse.
import { useState } from 'react'
import { KIND_SIDE, nextOccurrence, presetOf, remainingCount, todayIso, type CalEvent } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { Icon } from '../Icon'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { EventForm } from './EventForm'
import { blankEvent, useEvents } from './useEvents'

const k = (s: string) => s as keyof Dict

export function RecurringList() {
  const { t, date } = useI18n()
  const { state } = useStore()
  const settings = state.data!.settings
  const { events, save, remove } = useEvents()
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const today = todayIso()
  const list = events.filter(e => e.repeat && KIND_SIDE[e.kind] === 'out')
    .map(e => ({ e, next: nextOccurrence(e, today), left: remainingCount(e, today) }))
    .sort((a, b) => (a.next ?? '9').localeCompare(b.next ?? '9'))
  const isNew = edit && !events.some(e => e.id === edit.id)
  return <>
    <p className="muted small">{t('rec.hint')}</p>
    {list.length > 0 && <ul className="group-list">{list.map(({ e, next, left }) => (
      <li key={e.id}><button className={`row${e.active ? '' : ' muted'}`} onClick={() => { tap(); setEdit(e) }}>
        <span className="row-main"><span>{e.title}</span>
          <small>{t(k(`rp.${presetOf(e.repeat)}`))}{next ? ` · ${t('rec.next', { date: date(next, { day: 'numeric', month: 'short' }) })}` : ` · ${t('rec.ended')}`}{left != null && left > 0 ? ` · ${t('ev.left', { n: left })}` : ''}</small></span>
        {e.amount != null && <span className="row-value"><Money value={e.amount} currency={settings.currency} /></span>}
        <Icon name="chevron" size={18} className="row-chev" />
      </button></li>))}
    </ul>}
    <button className="link-btn" onClick={() => { tap(); setEdit(blankEvent(today)) }}>+ {t('rec.add')}</button>
    <Sheet open={!!edit} onClose={() => setEdit(null)} title={isNew ? t('rec.add') : t('ev.edit')}>
      {edit && <EventForm event={edit} settings={settings} today={today} onSave={e => { save(e); setEdit(null) }}
        onDelete={isNew ? undefined : () => { remove(edit.id); setEdit(null) }} />}
    </Sheet>
  </>
}
