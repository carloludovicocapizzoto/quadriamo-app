// Il dettaglio di una voce del calendario: quando, quanto, come si ripete, quante ne restano; "Fatto" e "Modifica".
import { KIND_SIDE, nextOccurrence, presetOf, remainingCount, type CalEvent } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { Icon } from '../Icon'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'

const k = (s: string) => s as keyof Dict

export function EventDetail({ event, date: day, currency, today, onToggle, onEdit }: {
  event: CalEvent; date: string; currency: string; today: string; onToggle: () => void; onEdit: () => void
}) {
  const { t, date } = useI18n()
  const done = event.done.includes(day)
  const side = KIND_SIDE[event.kind]
  const preset = presetOf(event.repeat)
  const repeat = preset === 'custom' && event.repeat ? t('rp.customLine', { n: event.repeat.every, unit: t(k(`unit.${event.repeat.unit}`)) }) : t(k(`rp.${preset}`))
  const next = event.repeat ? nextOccurrence(event, day > today ? day : today) : null
  const left = remainingCount(event, today)
  return (
    <div className="event-detail">
      <p className="eyebrow-small">{t(k(`ev.kind.${event.kind}`))}</p>
      <h2>{event.title}</h2>
      {event.amount != null && <Money className="outcome-amount" value={side === 'in' ? event.amount : -event.amount} currency={currency} />}
      <p className="outcome-label">{date(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <ul className="ed-facts">
        <li><span>{t('ev.repeat')}</span><b>{repeat}</b></li>
        {next && next !== day && <li><span>{t('ev.nextTime')}</span><b>{date(next, { day: 'numeric', month: 'long' })}</b></li>}
        {left != null && <li><span>{t('ev.leftLabel')}</span><b>{left}</b></li>}
        {side === 'out' && <li><span>{t('ev.budget')}</span><b>{event.category ? t('ev.inBudget') : t('ev.noBudget')}</b></li>}
      </ul>
      <button className={`btn wide${done ? '' : ' primary'}`} onClick={() => { tap(); onToggle() }}>
        <Icon name="check" size={16} />{done ? t('ev.undo') : t('ev.markDone')}</button>
      <button className="btn wide top-gap" onClick={onEdit}><Icon name="edit" size={16} />{t('ev.edit')}</button>
    </div>
  )
}
